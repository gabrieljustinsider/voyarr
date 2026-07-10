#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$DIR/../.." && pwd)"

source "$PROJECT_DIR/deploy/lib/secrets.sh"
load_env

TARGET="${SCRAPER_BROWSER_TARGET:-browserless-io}"

DRIVER="$DIR/$TARGET.sh"
if [ ! -f "$DRIVER" ]; then
  echo "ERROR: No scraper-browser driver for target '$TARGET' (expected $DRIVER)" >&2
  exit 1
fi

source "$DRIVER"
deploy_scraper_browser
