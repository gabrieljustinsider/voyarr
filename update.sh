#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
source "$DIR/deploy/lib/secrets.sh"

echo "Starting Voyarr Upgrade & Pre-flight Check..."

load_env

check_critical_vars "MASTER_KEY" "SECRET_KEY" || exit 1

echo "Environment variables verified."

echo "Checking database status for pre-upgrade backup..."

if docker ps --format '{{.Names}}' | grep -q "^voyarr-db$"; then
  TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
  BACKUP_FILE="/backups/pre_upgrade_${TIMESTAMP}.sql"

  DB_USER="${POSTGRES_USER:-voyarr_user}"
  DB_NAME="${POSTGRES_DB:-voyarr}"

  echo "Backing up database to $BACKUP_FILE..."
  docker compose exec -T db bash -c "pg_dump -U \"$DB_USER\" -d \"$DB_NAME\" > \"$BACKUP_FILE\""

  if [ $? -eq 0 ]; then
    echo "Database backup successful!"
  else
    echo "Database backup failed! Aborting upgrade to protect data."
    exit 1
  fi
else
  echo "Database container is not currently running. Skipping live backup."
fi

echo "Pulling latest images..."
docker compose pull
echo "Starting updated containers..."
docker compose up -d

echo "Voyarr upgrade complete!"
