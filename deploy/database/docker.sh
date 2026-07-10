deploy_database() {
  echo "Deploying database via Docker (PostgreSQL)..."
  "$PROJECT_DIR/deploy/compose.sh" up -d --no-recreate db 2>/dev/null || \
    "$PROJECT_DIR/deploy/compose.sh" up -d db
  echo "Database (Docker PostgreSQL) deployed."
}
