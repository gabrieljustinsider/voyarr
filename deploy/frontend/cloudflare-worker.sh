deploy_frontend() {
  echo "Deploying frontend via Cloudflare Worker..."

  local backend_origin="${FRONTEND_BACKEND_URL:-}"
  if [ -z "$backend_origin" ]; then
    echo "ERROR: FRONTEND_BACKEND_URL must be set when FRONTEND_TARGET=cloudflare-worker" >&2
    exit 1
  fi

  echo "Building frontend..."
  cd "$PROJECT_DIR/frontend"
  VITE_API_BASE_URL="/api" npx vite build --mode production

  echo "Deploying Worker with assets..."
  cd "$PROJECT_DIR/worker"
  if command -v wrangler &>/dev/null; then
    echo "$backend_origin" | wrangler secret put BACKEND_ORIGIN 2>/dev/null || true
    wrangler deploy
  elif command -v npx &>/dev/null; then
    echo "$backend_origin" | npx wrangler secret put BACKEND_ORIGIN 2>/dev/null || true
    npx wrangler deploy
  else
    echo "ERROR: wrangler CLI not found. Install with: npm install -g wrangler" >&2
    exit 1
  fi

  echo "Frontend (Cloudflare Worker) deployed to voyarr.gabrieljustinsider.com."
}
