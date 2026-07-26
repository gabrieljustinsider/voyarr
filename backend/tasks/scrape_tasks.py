import os
import requests
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
from celery import shared_task  # type: ignore
from models import SiteRecipe
from services.scraper import DynamicScraper
from db_utils import get_db_session
from typing import Any


@shared_task(bind=True)
def scrape_url_task(self: Any, url: str, recipe_id: int) -> dict[str, Any] | None:
    """
    Fetches HTML from a URL and uses the DynamicScraper to extract metadata.
    """
    self.update_state(state="PROGRESS", meta={"progress": 0, "step": "Validating URL..."})

    try:
        from routers.download import validate_url_ssrf
        validate_url_ssrf(url)
    except Exception as e:
        print(f"SSRF validation failed for {url}: {e}")
        return None

    self.update_state(state="PROGRESS", meta={"progress": 5, "step": "Checking feature permissions..."})

    with get_db_session() as db:
        from db_utils import is_feature_enabled
        if not is_feature_enabled(db, "scraping"):
            print(f"Skipping scraping task for {url}: scraping feature is globally disabled.")
            return None

        recipe = None
        try:
            recipe = db.query(SiteRecipe).filter(SiteRecipe.id == recipe_id).first()
            if not recipe:
                print(f"Error: SiteRecipe with ID {recipe_id} not found.")
                return None

            self.update_state(state="PROGRESS", meta={"progress": 15, "step": "Launching browser..."})

            with sync_playwright() as p:
                browserless_url = os.getenv("BROWSERLESS_URL")
                browserless_token = os.getenv("BROWSERLESS_TOKEN")
                if browserless_url:
                    if browserless_token:
                        sep = "&" if "?" in browserless_url else "?"
                        browserless_url = f"{browserless_url}{sep}token={browserless_token}"
                    browser = p.chromium.connect_over_cdp(browserless_url)
                else:
                    proxy_url = os.getenv("GLOBAL_PROXY_URL")
                    proxy_enabled = os.getenv("GLOBAL_PROXY_ENABLED") == "true"
                    launch_kwargs: dict[str, Any] = {"headless": True}
                    if proxy_enabled and proxy_url:
                        launch_kwargs["proxy"] = {"server": proxy_url}
                    browser = p.chromium.launch(**launch_kwargs)

                try:
                    global_ua = os.getenv("DEFAULT_USER_AGENT")
                    ua = (
                        global_ua
                        if global_ua
                        else "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                    )

                    self.update_state(state="PROGRESS", meta={"progress": 30, "step": "Fetching page..."})

                    context = browser.new_context(user_agent=ua)
                    page = context.new_page()

                    page.route(
                        "**/*",
                        lambda route: route.abort()
                        if route.request.resource_type in ["image", "media", "font", "stylesheet"]
                        else route.continue_()
                    )

                    self.update_state(state="PROGRESS", meta={"progress": 50, "step": "Rendering JavaScript..."})

                    page.goto(url, wait_until="networkidle", timeout=20000)
                    html_content = page.content()
                finally:
                    browser.close()

                self.update_state(state="PROGRESS", meta={"progress": 80, "step": "Extracting metadata..."})

                scraper = DynamicScraper(recipe)
                metadata = scraper.parse(html_content)

            print(f"Scraped Metadata for {url}:\n{metadata}")
            self.update_state(state="PROGRESS", meta={"progress": 100, "step": "Complete"})
            return metadata

        except PlaywrightTimeoutError as e:
            print(f"Timeout waiting for JS to render on {url}: {str(e)}")
            self.update_state(state="PROGRESS", meta={"progress": 60, "step": "Playwright timed out, falling back to requests..."})
            try:
                if not recipe:
                    return None

                global_ua = os.getenv("DEFAULT_USER_AGENT")
                ua = (
                    global_ua
                    if global_ua
                    else "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
                )

                self.update_state(state="PROGRESS", meta={"progress": 70, "step": "Fallback: fetching with requests..."})

                headers = {"User-Agent": ua}
                response = requests.get(url, headers=headers, timeout=15)
                response.raise_for_status()

                self.update_state(state="PROGRESS", meta={"progress": 85, "step": "Fallback: extracting metadata..."})

                scraper = DynamicScraper(recipe)
                metadata = scraper.parse(response.text)
                print(f"Fallback Scraped Metadata for {url}:\n{metadata}")
                self.update_state(state="PROGRESS", meta={"progress": 100, "step": "Complete (fallback)"})
                return metadata
            except Exception as fallback_e:
                print(f"Fallback scraping error for {url}: {str(fallback_e)}")
                return None
        except Exception as e:
            print(f"Scraping error for {url}: {str(e)}")
            return None
