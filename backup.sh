#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
source "$DIR/deploy/lib/secrets.sh"

echo "Starting Voyarr Database Backup..."

load_env

DB_TARGET="${DATABASE_TARGET:-docker}"

if [ "$DB_TARGET" != "docker" ]; then
  echo "Database target is '$DB_TARGET' — local container backup is not applicable."
  echo "Use your cloud provider's backup mechanism instead."
  exit 0
fi

if docker ps --format '{{.Names}}' | grep -q "^voyarr-db$"; then
  TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
  BACKUP_FILE="/backups/manual_db_backup_${TIMESTAMP}.sql"

  DB_USER="${POSTGRES_USER:-voyarr_user}"
  DB_NAME="${POSTGRES_DB:-voyarr}"

  echo "Backing up database to $BACKUP_FILE..."
  docker compose exec -T db bash -c "pg_dump -U \"$DB_USER\" -d \"$DB_NAME\" > \"$BACKUP_FILE\""

  if [ $? -eq 0 ]; then
    echo "Database backup successful!"
  fi
else
  echo "ERROR: Database container is not running. Cannot perform backup."
  exit 1
fi
