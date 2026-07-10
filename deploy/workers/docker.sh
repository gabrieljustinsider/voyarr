deploy_workers() {
  echo "Deploying workers via Docker..."
  "$PROJECT_DIR/deploy/compose.sh" up -d --no-recreate celery_worker celery_beat 2>/dev/null || \
    "$PROJECT_DIR/deploy/compose.sh" up -d celery_worker celery_beat
  echo "Workers (Docker) deployed."
}
