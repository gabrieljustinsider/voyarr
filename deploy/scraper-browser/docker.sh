deploy_scraper_browser() {
  echo "Deploying scraper browser via Docker..."
  "$PROJECT_DIR/deploy/compose.sh" up -d --no-recreate browserless 2>/dev/null || \
    "$PROJECT_DIR/deploy/compose.sh" up -d browserless
  echo "Scraper browser (Docker) deployed."
}
