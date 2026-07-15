deploy_backend_api() {
  echo "Deploying backend API via Cloudflare Worker..."

  local backend_origin="${WORKER_BACKEND_ORIGIN:-}"
  if [ -z "$backend_origin" ]; then
    echo "ERROR: WORKER_BACKEND_ORIGIN must be set when BACKEND_API_TARGET=cloudflare-worker" >&2
    exit 1
  fi

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

  echo "Backend API (Cloudflare Worker) deployed."
}
