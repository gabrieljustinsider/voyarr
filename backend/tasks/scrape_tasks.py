import requests
import urllib.parse
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
from celery import shared_task
from models import SiteRecipe
from services.scraper import DynamicScraper
from db_utils import get_db_session


@shared_task
def scrape_url_task(url: str, recipe_id: int):
    """
    Fetches HTML from a URL and uses the DynamicScraper to extract metadata.
    """
    if not url.lower().startswith(("http://", "https://")):
        print(f"Error: Invalid URL scheme for {url}")
        return None

    try:
        parsed = urllib.parse.urlparse(url)
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
                print(f"Error: Disallowed internal numeric IP {hostname}")
                return None
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
            print(f"Error: Disallowed internal hostname {hostname}")
            return None
    except Exception as url_err:
        print(f"Error parsing or validating URL: {url_err}")

    with get_db_session() as db:
        try:
            # Fetch the scraping recipe from the DB
            recipe = db.query(SiteRecipe).filter(SiteRecipe.id == recipe_id).first()
            if not recipe:
                print(f"Error: SiteRecipe with ID {recipe_id} not found.")
                return None

            # Use Playwright to launch a headless browser and wait for JS to render
            with sync_playwright() as p:
                browser = p.chromium.launch(headless=True)
                try:
                    context = browser.new_context(
                        user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                    )
                    page = context.new_page()

                    # networkidle ensures dynamic scripts have finished fetching data
                    page.goto(url, wait_until="networkidle", timeout=20000)
                    html_content = page.content()
                finally:
                    browser.close()

                # Scrape the metadata using our logic
                scraper = DynamicScraper(recipe)
                metadata = scraper.parse(html_content)

            print(f"Scraped Metadata for {url}:\n{metadata}")
            return metadata

        except PlaywrightTimeoutError as e:
            print(f"Timeout waiting for JS to render on {url}: {str(e)}")
            print("Falling back to standard requests scraper...")
            try:
                headers = {
                    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                }
                response = requests.get(url, headers=headers, timeout=15)
                response.raise_for_status()

                scraper = DynamicScraper(recipe)
                metadata = scraper.parse(response.text)
                print(f"Fallback Scraped Metadata for {url}:\n{metadata}")
                return metadata
            except Exception as fallback_e:
                print(f"Fallback scraping error for {url}: {str(fallback_e)}")
                return None
        except Exception as e:
            print(f"Scraping error for {url}: {str(e)}")
            return None
