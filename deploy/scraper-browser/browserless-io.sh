deploy_scraper_browser() {
  echo "Configuring scraper via browserless.io..."

  if [ -z "${BROWSERLESS_TOKEN:-}" ]; then
    echo "WARNING: BROWSERLESS_TOKEN is not set. browserless.io may not work without a token." >&2
  fi

  BROWSERLESS_URL="${BROWSERLESS_URL:-wss://chrome.browserless.io}"
  export BROWSERLESS_URL
  export BROWSERLESS_TOKEN="${BROWSERLESS_TOKEN:-}"

  echo "Scraper browser (browserless.io) configured: $BROWSERLESS_URL"
}
