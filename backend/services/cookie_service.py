import requests
from datetime import datetime, timezone
from sqlalchemy.orm import Session
from models import SessionCookie
import re


class CookieService:
    @staticmethod
    def test_cookie_validity(cookie_data: str, test_url: str) -> bool:
        """
        Attempts to make a lightweight request to the provider to test if the cookie is still active.
        """
        try:
            from utils import validate_url_ssrf
            validate_url_ssrf(test_url)
        except Exception as ssrf_err:
            print(f"Cookie validation blocked: {ssrf_err}")
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
