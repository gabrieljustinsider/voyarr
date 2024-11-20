from abc import ABC, abstractmethod
from typing import Dict, List, Optional
import requests
from bs4 import BeautifulSoup
import re


class ProviderBase(ABC):
    """Base class for media providers with scraping capabilities."""

    def __init__(self, base_url: str, credentials: Optional[Dict[str, str]] = None):
        self.base_url = base_url.rstrip("/")
        self.credentials = credentials or {}
        self.session = requests.Session()

    @abstractmethod
    def login(self) -> bool:
        """Authenticate with the provider."""
        pass

    @abstractmethod
    def scrape_metadata(self, url: str) -> Dict:
        """Scrape metadata from a media page."""
        pass

    @abstractmethod
    def get_download_url(self, media_id: str) -> str:
        """Get direct download URL for media."""
        pass

    def get_page_content(self, url: str) -> BeautifulSoup:
        """Fetch and parse page content."""
        response = self.session.get(url)
        response.raise_for_status()
        return BeautifulSoup(response.content, "html.parser")

    def extract_with_css(self, soup: BeautifulSoup, selector: str) -> List[str]:
        """Extract text using CSS selector."""
        elements = soup.select(selector)
        return [elem.get_text(strip=True) for elem in elements]

    def extract_with_xpath(self, soup: BeautifulSoup, xpath: str) -> List[str]:
        """Extract text using XPath (requires lxml)."""
        # Note: BeautifulSoup with lxml parser supports xpath
        return soup.xpath(xpath)

    def extract_with_regex(self, text: str, pattern: str) -> List[str]:
        """Extract data using regex."""
        matches = re.findall(pattern, text, re.IGNORECASE)
        return matches

    def build_filename(self, metadata: Dict, pattern: str) -> str:
        """Build filename based on naming pattern."""
        try:
            from collections import defaultdict

            safe_metadata = defaultdict(lambda: "unknown", metadata)
            return pattern.format_map(safe_metadata)
        except Exception:
            return f"{metadata.get('title', 'unknown')}.mp4"
