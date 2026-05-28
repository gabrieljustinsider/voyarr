import os
import time
import subprocess  # nosec B404
from datetime import datetime, timezone
from celery import shared_task  # type: ignore
from models import LiveStream, Vault, LibraryEntry, Provider
from security import decrypt_data
from db_utils import get_db_session
import shutil
from typing import Any


@shared_task(bind=True)
def record_live_stream_task(self: Any, stream_id: int) -> None:
    """Background task to record live HLS streams using streamlink with Vault-secured credentials."""
    with get_db_session() as db:
        stream = db.query(LiveStream).filter(LiveStream.id == stream_id).first()
        if not stream:
            print(f"Error: Live stream config with ID {stream_id} not found.")
            return

        # Double check status is recording
        if str(stream.status) != "recording":
            stream.status = "recording"  # type: ignore
            db.commit()

        # Set up directories
        live_dir = os.path.join(
            get_media_roots_fallback(), "downloads", "live_recordings"
        )
        os.makedirs(live_dir, exist_ok=True)

        # Generate filename
        safe_name = "".join([c if c.isalnum() else "_" for c in str(stream.name)])
        filename = (
            f"{safe_name}_{datetime.now(timezone.utc).strftime('%Y%m%d_%H%M%S')}.mp4"
        )
        out_path = os.path.realpath(os.path.join(live_dir, filename))

        stream.current_output_path = out_path  # type: ignore
        db.commit()

        # Gather authentication from Vault
        cookie_entry = (
            db.query(Vault)
            .filter_by(
                entity_type="live_stream_auth", entity_id=stream_id, key="cookies"
            )
            .first()
        )
        header_entry = (
            db.query(Vault)
            .filter_by(
                entity_type="live_stream_auth", entity_id=stream_id, key="headers"
            )
            .first()
        )

        # Build streamlink command
        cmd: list[str] = ["streamlink", "--hls-live-restart", str(stream.url), "best", "-o", out_path]

        # Resolve provider from URL domain to find linked credentials / cookies
        matched_provider = None
        from urllib.parse import urlparse
        try:
            parsed_url = urlparse(str(stream.url))
            domain = parsed_url.netloc.lower()
            if domain.startswith("www."):
                domain = domain[4:]
            
            all_providers = db.query(Provider).all()
            for p in all_providers:
                p_url = p.base_url.lower()
                if domain in p_url or p.name.lower() in domain or domain in p.name.lower():
                    matched_provider = p
                    break
        except Exception as e:
            print(f"Error parsing domain for provider match: {e}")

        cookies_injected = False
        # If a provider is matched, pull linked cookies
        if matched_provider:
            from models import SessionCookie, Credential
            cookie_obj = db.query(SessionCookie).filter(
                SessionCookie.provider_id == matched_provider.id,
                SessionCookie.status == "active"
            ).first()
            if cookie_obj:
                vault_cookie = db.query(Vault).filter_by(
                    entity_type="session_cookie",
                    entity_id=cookie_obj.id,
                    key="cookie_text"
                ).first()
                if vault_cookie and vault_cookie.encrypted_value:  # type: ignore
                    cookies_val = decrypt_data(str(vault_cookie.encrypted_value))
                    if cookies_val:
                        cmd.extend(["--http-cookie", cookies_val])
                        cookies_injected = True

            # Check for credential user/pass to pass as headers or plugin args if needed
            cred_obj = db.query(Credential).filter(Credential.provider_id == matched_provider.id).first()
            if cred_obj:
                vault_items = db.query(Vault).filter_by(entity_type="credential", entity_id=cred_obj.id).all()
                vault_dict = {str(item.key): decrypt_data(str(item.encrypted_value)) for item in vault_items if item.encrypted_value}  # type: ignore
                user = vault_dict.get("username")
                pwd = vault_dict.get("password")
                if user and pwd:
                    # Streamlink plugins often accept credentials as custom args or HTTP basic auth
                    cmd.extend(["--http-header", f"Authorization=Basic {user}:{pwd}"])

        if cookie_entry and cookie_entry.encrypted_value and not cookies_injected:  # type: ignore
            cookies_val = decrypt_data(str(cookie_entry.encrypted_value))
            if cookies_val:
                cmd.extend(["--http-cookie", cookies_val])

        if header_entry and header_entry.encrypted_value:  # type: ignore
            headers_val = decrypt_data(str(header_entry.encrypted_value))
            if headers_val:
                for h in headers_val.split(";"):
                    if "=" in h:
                        cmd.extend(["--http-header", h.strip()])

    # Check if streamlink is installed
    if not shutil.which("streamlink"):
        with get_db_session() as db:
            stream = db.query(LiveStream).filter(LiveStream.id == stream_id).first()
            if stream:
                stream.status = "failed"  # type: ignore
                db.commit()
            print("Error: streamlink is not installed in the system environment.")
            return

    # Start streamlink subprocess (parameters are safe array, no shell expansion - nosec B603)
    start_time = time.time()
    try:
        proc = subprocess.Popen(cmd)  # nosec B603
        with get_db_session() as db:
            stream = db.query(LiveStream).filter(LiveStream.id == stream_id).first()
            if stream:
                stream.pid = proc.pid  # type: ignore
                stream.celery_task_id = self.request.id  # type: ignore
                db.commit()
    except Exception as e:
        with get_db_session() as db:
            stream = db.query(LiveStream).filter(LiveStream.id == stream_id).first()
            if stream:
                stream.status = "failed"  # type: ignore
                db.commit()
            print(f"Exception starting streamlink: {e}")
            return

    # Monitoring Loop
    try:
        while True:
            # Check if subprocess finished
            poll = proc.poll()
            if poll is not None:
                print(f"Streamlink finished with return code {poll}.")
                break

            # Read stream state from DB to check if STOP was requested
            with get_db_session() as db:
                stream = db.query(LiveStream).filter(LiveStream.id == stream_id).first()
                if not stream:
                    print("Live stream configuration deleted. Terminating process.")
                    proc.terminate()
                    proc.wait()
                    break

                if str(stream.status) == "paused":
                    # Suspended by SIGSTOP, wait without updating elapsed
                    pass
                elif str(stream.status) != "recording":
                    print(
                        f"Stop requested, status is {stream.status}. Terminating process."
                    )
                    proc.terminate()
                    try:
                        proc.wait(timeout=5)
                    except subprocess.TimeoutExpired:
                        proc.kill()
                    break
                else:
                    # Update live statistics
                    file_size = 0
                    if os.path.exists(out_path):
                        file_size = os.path.getsize(out_path)

                    elapsed = int(time.time() - start_time)

                    stream.written_size = file_size  # type: ignore
                    stream.elapsed_seconds = elapsed  # type: ignore
                    db.commit()

            time.sleep(5)
    except Exception as e:
        print(f"Error during live monitoring loop: {e}")
        proc.kill()

    # Finalize state & auto-index
    elapsed_seconds = int(time.time() - start_time)
    with get_db_session() as db:
        stream = db.query(LiveStream).filter(LiveStream.id == stream_id).first()
        if not stream:
            return

        final_size = 0
        if os.path.exists(out_path):
            final_size = os.path.getsize(out_path)

        if final_size > 1024 * 50:  # > 50KB to verify validity
            # Auto-index into Library
            provider = db.query(Provider).filter(Provider.name == "LiveStream").first()
            if not provider:
                provider = Provider(
                    name="LiveStream",
                    base_url="http://localhost",
                    naming_pattern="{title}",
                    separator="_",
                )
                db.add(provider)
                db.flush()

            # Create catalog record
            new_entry = LibraryEntry(
                provider_id=provider.id,
                title=f"Live: {stream.name} ({datetime.now().strftime('%Y-%m-%d %H:%M:%S')})",
                file_path=out_path,
                file_size=final_size,
                resolution="1080p",
                duration=elapsed_seconds,
                tags=["Live Recording", stream.name],
                entry_metadata={
                    "stream_id": stream.id,
                    "recorded_at": datetime.now().isoformat(),
                },
            )
            db.add(new_entry)
            db.commit()

            try:
                from services.notification_service import NotificationService

                NotificationService.check_and_notify_favorites(db, new_entry)  # type: ignore
                NotificationService.notify_global(
                    db,
                    "task_completed",
                    "Live Recording Completed",
                    f"Successfully recorded and indexed live stream '{new_entry.title}'.",
                )
            except Exception as notif_err:
                print(
                    f"Error sending live recording completion notification: {notif_err}"
                )

            stream.status = "idle"  # type: ignore
            print(f"Successfully finished recording and indexed: {new_entry.title}")
        else:
            # Empty or invalid
            stream.status = "failed"  # type: ignore
            print(
                f"Recording finished but output file was too small or missing ({final_size} bytes)."
            )

            try:
                from services.notification_service import NotificationService

                NotificationService.notify_global(
                    db,
                    "task_completed",
                    "Live Recording Failed",
                    f"Recording finished but output file for live stream '{stream.name}' was too small or missing.",
                )
            except Exception as notif_err:
                print(f"Error sending live recording failure notification: {notif_err}")

        db.commit()


def get_media_roots_fallback() -> str:
    """Parse media roots helper similar to utils."""
    try:
        from models import Settings

        with get_db_session() as db:
            setting = (
                db.query(Settings).filter(Settings.key == "media_root_path").first()
            )
            if setting and setting.value:  # type: ignore
                paths = [p.strip() for p in setting.value.split(",") if p.strip()]
                if paths:
                    return os.path.realpath(os.path.expanduser(paths[0]))
    except Exception:
        pass
    paths_str = os.getenv("CONTAINER_MEDIA_PATHS", "/media/storage")
    paths = [p.strip() for p in paths_str.split(",") if p.strip()]
    return os.path.realpath(
        os.path.expanduser(paths[0] if paths else "/media/storage")
    )
