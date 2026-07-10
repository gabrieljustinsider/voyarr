deploy_frontend() {
  echo "Deploying frontend via Cloudflare Pages..."

  local backend_url="${FRONTEND_BACKEND_URL:-}"
  if [ -z "$backend_url" ]; then
    echo "ERROR: FRONTEND_BACKEND_URL must be set when FRONTEND_TARGET=cloudflare-pages" >&2
    exit 1
  fi

  local project_name="${CLOUDFLARE_PAGES_PROJECT_NAME:-voyarr}"

  echo "Building frontend with API base: $backend_url"
  cd "$PROJECT_DIR/frontend"
  VITE_API_BASE_URL="$backend_url" npm run build

  if command -v wrangler &>/dev/null; then
    wrangler pages deploy dist --project-name "$project_name"
  elif command -v npx &>/dev/null; then
    npx wrangler pages deploy dist --project-name "$project_name"
  else
    echo "ERROR: wrangler CLI not found. Install it with: npm install -g wrangler" >&2
    exit 1
  fi

  echo "Frontend (Cloudflare Pages) deployed."
}
