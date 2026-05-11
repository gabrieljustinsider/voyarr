import requests
from playwright.sync_api import sync_playwright, TimeoutError as PlaywrightTimeoutError
from celery import shared_task
from database import SessionLocal
from models import SiteRecipe
from services.scraper import DynamicScraper

@shared_task
def scrape_url_task(url: str, recipe_id: int):
    """
    Fetches HTML from a URL and uses the DynamicScraper to extract metadata.
    """
    db = SessionLocal()
    try:
        # Fetch the scraping recipe from the DB
        recipe = db.query(SiteRecipe).filter(SiteRecipe.id == recipe_id).first()
        if not recipe:
            print(f"Error: SiteRecipe with ID {recipe_id} not found.")
            return None
            
        # Use Playwright to launch a headless browser and wait for JS to render
        with sync_playwright() as p:
            browser = p.chromium.launch(headless=True)
            context = browser.new_context(
                user_agent="Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36"
            )
            page = context.new_page()
            
            # networkidle ensures dynamic scripts have finished fetching data
            page.goto(url, wait_until="networkidle", timeout=20000)
            html_content = page.content()
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
    finally:
        db.close()