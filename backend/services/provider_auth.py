import os
from typing import Any

from sqlalchemy.orm import Session
from models import Provider, SessionCookie, Credential, Vault, Settings
from security import encrypt_data
from services.credential_vault import get_fields


# Login page selectors for cookie-based (Playwright) sign-in.
# Add entries per provider as needed. `success_url_fragment` is checked after submit
# to decide whether the login succeeded (e.g. the URL no longer contains "login").
LOGIN_CONFIGS: dict[str, dict[str, str]] = {
    "OnlyFans": {
        "login_url": "https://onlyfans.com/login",
        "username_selector": "input[name='email_address'], input[name='email'], input[type='email']",
        "password_selector": "input[name='password'], input[type='password']",
        "otp_selector": "input[name='two_factor'], input[name='verification_code'], input[name='otp']",
        "submit_selector": "button[type='submit'], form button",
        "success_url_fragment": "home",
    },
}


def get_login_strategy(provider: Provider, db: Session) -> dict[str, Any]:
    """Determine the best automatic sign-in strategy for a provider."""
    methods = provider.supported_methods or []
    methods = [m.lower() for m in methods]

    cred = db.query(Credential).filter(Credential.provider_id == provider.id).first()
    if not cred:
        return {
            "strategy": "none",
            "requires_login": False,
            "has_credentials": False,
            "reason": "No automatic sign-in strategy is available for this provider.",
        }
    values = get_fields(db, cred.id)
    has_creds = bool(values.get("username") and values.get("password"))

    if provider.name in LOGIN_CONFIGS:
        return {
            "strategy": "cookie",
            "requires_login": True,
            "has_credentials": has_creds,
            "reason": f"{provider.name} requires an authenticated browser session.",
        }

    if "yt-dlp" in methods:
        if has_creds:
            return {
                "strategy": "ytdlp",
                "requires_login": False,
                "has_credentials": True,
                "reason": "yt-dlp can pass credentials directly at download time.",
            }
        return {
            "strategy": "ytdlp",
            "requires_login": False,
            "has_credentials": False,
            "reason": "Open tube site; no authentication is usually required.",
        }

    return {
        "strategy": "none",
        "requires_login": False,
        "has_credentials": has_creds,
        "reason": "No automatic sign-in strategy is available for this provider.",
    }


def _launch_browser():
    from playwright.sync_api import sync_playwright

    proxy_url = os.getenv("GLOBAL_PROXY_URL")
    proxy_enabled = os.getenv("GLOBAL_PROXY_ENABLED") == "true"
    launch_kwargs: dict[str, Any] = {"headless": True}
    if proxy_enabled and proxy_url:
        launch_kwargs["proxy"] = {"server": proxy_url}
    p = sync_playwright().start()
    browser = p.chromium.launch(**launch_kwargs)
    return p, browser


def _capture_cookies(page) -> str:
    """Serialize the page's cookies into a Netscape cookie file suitable for yt-dlp/streamlink."""
    cookies = page.context.cookies()
    lines = ["# Netscape HTTP Cookie File"]
    for c in cookies:
        domain = c.get("domain", "")
        include_subdomains = "TRUE" if domain.startswith(".") else "FALSE"
        path = c.get("path", "/")
        secure = "TRUE" if c.get("secure") else "FALSE"
        expires = str(c.get("expires", 0))
        name = c.get("name", "")
        value = c.get("value", "")
        lines.append(
            f"{domain}\t{include_subdomains}\t{path}\t{secure}\t{expires}\t{name}\t{value}"
        )
    return "\n".join(lines)


def sign_in_with_browser(provider: Provider, username: str, password: str, otp_code: str | None = None) -> dict[str, Any]:
    """Drive a headless browser through the provider login and harvest the session cookie."""
    config = LOGIN_CONFIGS.get(provider.name)
    if not config:
        raise ValueError(f"No Playwright login config registered for {provider.name}.")

    import time
    from playwright.sync_api import TimeoutError as PlaywrightTimeoutError

    p = None
    browser = None
    try:
        p, browser = _launch_browser()
        context = browser.new_context(user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36")
        page = context.new_page()

        page.goto(config["login_url"], wait_until="domcontentloaded", timeout=30000)

        page.fill(config["username_selector"], username)
        page.fill(config["password_selector"], password)

        if otp_code:
            page.fill(config["otp_selector"], otp_code)

        page.click(config["submit_selector"])
        page.wait_for_load_state("networkidle", timeout=30000)

        # Brief grace period for redirects/async auth
        time.sleep(3)

        url = page.url
        success_fragment = config.get("success_url_fragment", "")
        success = bool(success_fragment and success_fragment in url)
        if success_fragment and not success:
            # Some flows redirect away from login without landing exactly on the fragment
            success = "/login" not in url.lower()

        if success:
            cookie_text = _capture_cookies(page)
            return {
                "status": "success",
                "cookie_text": cookie_text,
                "url": url,
            }
        return {"status": "failed", "url": url, "message": "Login did not complete (check credentials or 2FA)."}
    except PlaywrightTimeoutError as e:
        return {"status": "failed", "message": f"Login timed out: {e}"}
    finally:
        if browser:
            browser.close()
        if p:
            p.stop()


def test_sign_in(provider: Provider, db: Session) -> dict[str, Any]:
    """Dry-run: validate whether stored credentials/TOTP would authenticate (no cookie stored)."""
    strategy = get_login_strategy(provider, db)
    if strategy["strategy"] == "none":
        return {**strategy, "status": "not_supported"}

    cred = db.query(Credential).filter(Credential.provider_id == provider.id).first()
    if not cred:
        return {**strategy, "status": "no_credentials"}

    values = get_fields(db, cred.id)
    username = values.get("username", "")
    password = values.get("password", "")

    if not (username and password):
        return {**strategy, "status": "no_credentials"}

    if strategy["strategy"] == "cookie":
        from services.totp_service import get_totp_secret, current_code

        otp_code = None
        if get_totp_secret(db, cred.id):
            try:
                otp_code, _ = current_code(db, cred.id)
            except Exception:
                otp_code = None
        result = sign_in_with_browser(provider, username, password, otp_code)
        result["strategy"] = "cookie"
        result["requires_login"] = True
        return result

    # yt-dlp based providers: verify credentials by probing the provider's own auth API if available,
    # otherwise report credentials are stored and will be applied at download time.
    return {
        "status": "credentials_stored",
        "strategy": "ytdlp",
        "requires_login": False,
        "message": "Credentials are stored and will be passed to yt-dlp at download time.",
    }


def sign_in(provider: Provider, db: Session) -> dict[str, Any]:
    """Perform a real sign-in and persist the harvested session cookie."""
    strategy = get_login_strategy(provider, db)
    if strategy["strategy"] != "cookie":
        raise ValueError(
            f"Provider '{provider.name}' does not support interactive sign-in. "
            f"{strategy.get('reason', '')}"
        )

    cred = db.query(Credential).filter(Credential.provider_id == provider.id).first()
    if not cred:
        raise ValueError("No credentials stored for this provider.")

    values = get_fields(db, cred.id)
    username = values.get("username", "")
    password = values.get("password", "")

    from services.totp_service import get_totp_secret, current_code

    otp_code = None
    if get_totp_secret(db, cred.id):
        try:
            otp_code, _ = current_code(db, cred.id)
        except Exception:
            otp_code = None

    result = sign_in_with_browser(provider, username, password, otp_code)
    if result.get("status") == "success":
        cookie_text = result["cookie_text"]
        cookie = SessionCookie(
            provider_id=provider.id,
            name=f"Auto sign-in ({provider.name})",
            status="active",
        )
        db.add(cookie)
        db.flush()
        db.add(
            Vault(
                entity_type="session_cookie",
                entity_id=cookie.id,
                key="cookie_text",
                encrypted_value=encrypt_data(cookie_text),
            )
        )
        db.commit()
        result["cookie_id"] = cookie.id
    return result


def refresh_stale_cookie_if_needed(db: Session, provider_id: int) -> bool:
    """Re-run interactive sign-in to refresh an expired/near-expiry cookie, then replace it.

    Returns True if a cookie was refreshed. Rate-limited to once per 5 minutes per provider
    to avoid hammering the provider's login during repeated downloads.
    """
    import time

    from models import Credential as CredentialModel
    from security import decrypt_data

    cred = db.query(CredentialModel).filter(CredentialModel.provider_id == provider_id).first()
    if not cred:
        return False

    provider = db.query(Provider).filter_by(id=provider_id).first()
    if not provider or provider.name not in LOGIN_CONFIGS:
        return False

    # Rate limit: skip if a refresh already happened recently for this provider.
    last_refresh = (
        db.query(Settings)
        .filter(Settings.key == f"last_signin_refresh_{provider_id}")
        .first()
    )
    if last_refresh and last_refresh.value:
        try:
            if time.time() - float(last_refresh.value) < 300:
                return False
        except ValueError:
            pass

    # Find an active-but-stale cookie. A cookie with no expiry, or an expired one, qualifies.
    from datetime import datetime, timezone

    now = datetime.now(timezone.utc)
    stale_cookie = (
        db.query(SessionCookie)
        .filter(
            SessionCookie.provider_id == provider_id,
            SessionCookie.status == "active",
        )
        .first()
    )
    if stale_cookie:
        expires_at = stale_cookie.expires_at
        if expires_at is not None:
            expires_naive = expires_at
            if expires_naive.tzinfo is None:
                expires_naive = expires_naive.replace(tzinfo=timezone.utc)
            # Not stale yet (still valid > 1 hour from now)
            if (expires_naive - now).total_seconds() > 3600:
                return False
    else:
        return False

    from services.totp_service import get_totp_secret, current_code

    values = get_fields(db, cred.id)
    username = values.get("username", "")
    password = values.get("password", "")

    otp_code = None
    if get_totp_secret(db, cred.id):
        try:
            otp_code, _ = current_code(db, cred.id)
        except Exception:
            otp_code = None

    result = sign_in_with_browser(provider, username, password, otp_code)
    if result.get("status") != "success":
        return False

    # Update the existing cookie's vault entry rather than creating a new row.
    vault_entry = (
        db.query(Vault)
        .filter_by(
            entity_type="session_cookie", entity_id=stale_cookie.id, key="cookie_text"
        )
        .first()
    )
    if vault_entry:
        vault_entry.encrypted_value = encrypt_data(result["cookie_text"])
    else:
        db.add(
            Vault(
                entity_type="session_cookie",
                entity_id=stale_cookie.id,
                key="cookie_text",
                encrypted_value=encrypt_data(result["cookie_text"]),
            )
        )
    stale_cookie.status = "active"
    if last_refresh:
        last_refresh.value = str(time.time())
    else:
        db.add(Settings(key=f"last_signin_refresh_{provider_id}", value=str(time.time())))
    db.commit()
    return True