from bs4 import BeautifulSoup
from typing import Dict, Any
from models import SiteRecipe
from providers.base import ProviderBase

class DynamicScraper(ProviderBase):
    def __init__(self, base_url: str, recipe: SiteRecipe):
        super().__init__(base_url)
        self.recipe = recipe

    def login(self) -> bool:
        return True
        
    def get_download_url(self, media_id: str) -> str:
        return f"{self.base_url}/download/{media_id}"

    def scrape_metadata(self, url: str) -> Dict[str, Any]:
        soup = self.get_page_content(url)
        metadata = {}
        
        # Map using CSS Selectors
        if self.recipe.css_selectors:
            for key, selector in self.recipe.css_selectors.items():
                results = self.extract_with_css(soup, selector)
                metadata[key] = results[0] if len(results) == 1 else results
                
        # Map using XPath Selectors
        if self.recipe.xpath_selectors:
            for key, xpath in self.recipe.xpath_selectors.items():
                results = self.extract_with_xpath(soup, xpath)
                if results:
                    metadata[key] = results[0] if len(results) == 1 else results
                    
        # Regex patterns scanning the raw HTML body
        if self.recipe.regex_patterns:
            for key, pattern in self.recipe.regex_patterns.items():
                results = self.extract_with_regex(str(soup), pattern)
                if results:
                    metadata[key] = results[0] if len(results) == 1 else results
                    
        return metadata