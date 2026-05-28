from abc import ABC, abstractmethod
from typing import Dict, List, Optional, Any, cast
import requests
from bs4 import BeautifulSoup
import re


class ProviderBase(ABC):
    """Base class for media providers with scraping capabilities."""

    def __init__(self, base_url: str, credentials: Optional[Dict[str, str]] = None):
        self.base_url = base_url.rstrip("/")
        self.credentials = credentials or {}
        import os

        self.session = requests.Session()
        global_ua = os.getenv("DEFAULT_USER_AGENT")
        if global_ua:
            self.session.headers.update({"User-Agent": global_ua})

    @abstractmethod
    def login(self) -> bool:
        """Authenticate with the provider."""
        pass

    @abstractmethod
    def scrape_metadata(self, url: str) -> Dict[str, Any]:
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
        from lxml import html  # type: ignore

        tree = cast(Any, html.fromstring(str(soup)))  # type: ignore
        elements = cast(List[Any], tree.xpath(xpath))  # type: ignore
        results: List[str] = []
        for elem in elements:
            if isinstance(elem, str):
                results.append(elem.strip())
            elif hasattr(elem, "text_content"):
                results.append(str(elem.text_content()).strip())
            elif hasattr(elem, "text") and getattr(elem, "text"):
                results.append(str(getattr(elem, "text")).strip())
            else:
                results.append(str(elem).strip())
        return results

    def extract_with_regex(self, text: str, pattern: str) -> List[str]:
        """Extract data using regex."""
        matches = re.findall(pattern, text, re.IGNORECASE)
        return matches

    def build_filename(self, metadata: Dict[str, Any], pattern: str) -> str:
        """Build filename based on naming pattern."""
        try:
            from collections import defaultdict

            safe_metadata: defaultdict[str, Any] = defaultdict(lambda: "unknown", metadata)
            return pattern.format_map(safe_metadata)
        except Exception:
            return f"{metadata.get('title', 'unknown')}.mp4"
