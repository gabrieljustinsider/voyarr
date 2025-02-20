import requests
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from models import SessionCookie
import re
import urllib.parse


class CookieService:
    @staticmethod
    def test_cookie_validity(cookie_data: str, test_url: str) -> bool:
        """
        Attempts to make a lightweight request to the provider to test if the cookie is still active.
        """
        try:
            parsed = urllib.parse.urlparse(test_url)
            hostname = parsed.hostname.lower() if parsed.hostname else ""

            try:
                import ipaddress

                if hostname.startswith("0x"):
                    ip_int = int(hostname, 16)
                elif hostname.startswith("0") and hostname.isdigit():
                    ip_int = int(hostname, 8)
                elif hostname.isdigit():
                    ip_int = int(hostname)
                else:
                    ip_int = None
                if ip_int is not None and (
                    ipaddress.ip_address(ip_int).is_loopback
                    or ipaddress.ip_address(ip_int).is_private
                ):
                    print(f"SSRF blocked: Disallowed internal numeric IP {hostname}")
                    return False
            except ValueError:
                pass

            if hostname in [
                "localhost",
                "127.0.0.1",
                "0.0.0.0",  # nosec B104
                "169.254.169.254",
                "::1",
                "[::1]",
            ] or hostname.endswith((".internal", ".nip.io", ".xip.io", ".sslip.io")):
                print(f"SSRF blocked: Disallowed internal hostname {hostname}")
                return False
        except Exception:
            return False

        headers = {
            "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64)",
            "Cookie": cookie_data,
        }
        try:
            response = requests.get(test_url, headers=headers, timeout=10)
            # Heuristic: If we get a 401/403 or redirect to login, it is invalid
            if response.status_code in [401, 403]:
                return False
            if "login" in response.url.lower():
                return False
            return True
        except requests.RequestException:
            return False

    @staticmethod
    def auto_detect_limitations(cookie_data: str) -> dict:
        """
        Parses the cookie data to detect constraints (e.g., expiry).
        """
        limits = {}
        # Look for standard expiry fields in cookie strings
        match = re.search(r"expires=([^;]+)", cookie_data, re.IGNORECASE)
        if match:
            try:
                expires_str = match.group(1).strip()
                parsed_date = datetime.strptime(
                    expires_str, "%a, %d-%b-%Y %H:%M:%S GMT"
                )
                limits["expires_at"] = parsed_date
            except ValueError:
                pass
        return limits

    @staticmethod
    def refresh_cookie_statuses(db: Session):
        """Checks all active cookies for expiration."""
        active_cookies = (
            db.query(SessionCookie).filter(SessionCookie.status == "active").all()
        )
        for cookie in active_cookies:
            if (
                cookie.expires_at
                and datetime.now(timezone.utc).replace(tzinfo=None) > cookie.expires_at
            ):
                cookie.status = "expired"
        db.commit()
