#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"

echo "=== Voyarr Deployment ==="

# Order matters: database first, then backend (which needs database),
# then workers and scraper (which need backend), then frontend last.

for layer in database scraper-browser backend-api workers frontend; do
  echo ""
  echo "--- Deploying $layer ---"
  "$DIR/$layer/deploy.sh"
done

echo ""
echo "=== Voyarr deployment complete! ==="
