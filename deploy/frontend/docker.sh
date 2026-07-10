deploy_frontend() {
  echo "Deploying frontend via Docker..."
  "$PROJECT_DIR/deploy/compose.sh" up -d --no-recreate frontend 2>/dev/null || \
    "$PROJECT_DIR/deploy/compose.sh" up -d frontend
  echo "Frontend (Docker) deployed."
}
