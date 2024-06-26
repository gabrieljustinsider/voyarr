from bs4 import BeautifulSoup
import re
from typing import Dict, Any

class DynamicScraper:
    def __init__(self, recipe):
        """
        Initializes the scraper with a SiteRecipe model instance or dictionary.
        """
        self.css_selectors = getattr(recipe, 'css_selectors', {}) or {}
        self.regex_patterns = getattr(recipe, 'regex_patterns', {}) or {}

    def parse(self, html_content: str) -> Dict[str, Any]:
        """
        Parses the provided HTML content using the configured CSS selectors.
        Returns a dictionary mapping the configured fields to the extracted text.
        """
        soup = BeautifulSoup(html_content, 'html.parser')
        result = {}
        
        # Generic fallback extraction
        fallback_data = self._fallback_extract(soup)

        # 1. Apply CSS Selectors
        for field, selector in self.css_selectors.items():
            if not selector:
                continue
            
            elements = soup.select(selector)
            if not elements:
                continue
            
            # If multiple elements match (e.g., tags, performers), return a list.
            # If only one matches (e.g., title, description), return a single string.
            if len(elements) == 1:
                result[field] = elements[0].get_text(strip=True)
            else:
                result[field] = [el.get_text(strip=True) for el in elements]

        # 2. Apply Regex Patterns (useful for extracting IDs from scripts or raw text)
        for field, pattern in self.regex_patterns.items():
            if pattern and (match := re.search(pattern, html_content)):
                result[field] = match.group(1) if match.groups() else match.group(0)

        # 3. Apply Fallbacks for missing core fields
        for field, value in fallback_data.items():
            if not result.get(field):
                result[field] = value

        return result

    def _fallback_extract(self, soup: BeautifulSoup) -> Dict[str, Any]:
        """
        Extracts standard metadata (OpenGraph, standard meta tags) as a fallback
        if the dynamic recipe fails to capture core fields.
        """
        fallback = {}
        
        # Title fallback
        og_title = soup.find('meta', property='og:title')
        if og_title and og_title.get('content'):
            fallback['title'] = og_title['content']
        elif soup.title and soup.title.string:
            fallback['title'] = soup.title.string.strip()
            
        # Description fallback
        og_desc = soup.find('meta', property='og:description')
        meta_desc = soup.find('meta', attrs={'name': 'description'})
        if og_desc and og_desc.get('content'):
            fallback['description'] = og_desc['content']
        elif meta_desc and meta_desc.get('content'):
            fallback['description'] = meta_desc['content']
            
        # Thumbnail/Image fallback
        og_image = soup.find('meta', property='og:image')
        if og_image and og_image.get('content'):
            fallback['thumbnail_url'] = og_image['content']
            
        return fallback