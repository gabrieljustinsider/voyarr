deploy_backend_api() {
  echo "Deploying backend API via Docker..."
  "$PROJECT_DIR/deploy/compose.sh" up -d --no-recreate backend 2>/dev/null || \
    "$PROJECT_DIR/deploy/compose.sh" up -d backend
  echo "Backend API (Docker) deployed."
}
