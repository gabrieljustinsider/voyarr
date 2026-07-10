#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
source "$DIR/deploy/lib/secrets.sh"

load_env

RETENTION_DAYS="${BACKUP_RETENTION_DAYS:-30}"

echo "Cleaning backup files older than $RETENTION_DAYS days from voyarr-backups volume..."

docker run --rm \
  -v voyarr-backups:/backups \
  alpine:latest \
  sh -c "
    removed=\$(find /backups -type f \( -name '*.sql' -o -name '*.json' \) -mtime +$RETENTION_DAYS -delete -print)
    count=\$(echo \"\$removed\" | wc -l)
    echo \"Removed \$count old backup files.\"
    [ -z \"\$removed\" ] && echo 'No files to clean.'
  "

echo "Backup cleanup complete!"
