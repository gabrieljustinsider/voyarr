deploy_database() {
  echo "Configuring database via Neon..."

  if [ -z "${NEON_DATABASE_URL:-}" ]; then
    echo "ERROR: NEON_DATABASE_URL must be set when DATABASE_TARGET=neon" >&2
    exit 1
  fi

  export DATABASE_URL="$NEON_DATABASE_URL"

  if [ -n "${NEON_POOLED_DATABASE_URL:-}" ]; then
    export CELERY_BROKER_URL="${CELERY_BROKER_URL:-redis://redis:6379/0}"
  fi

  echo "Database (Neon) configured: DATABASE_URL set from NEON_DATABASE_URL."
}
