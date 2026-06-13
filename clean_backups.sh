#!/bin/bash

echo "🧹 Starting Voyarr Backup Log Rotation..."

# 1. Check if .env exists to extract BACKUP_ROOT
if [ -f .env ]; then
    BACKUP_ROOT=$(grep "^BACKUP_ROOT=" .env | cut -d '=' -f2- | tr -d ' "' | tr -d "'")
fi

# Fallback to a default if not found or empty
BACKUP_ROOT=${BACKUP_ROOT:-"/volume1/docker/voyarr/backups"}

if [ ! -d "$BACKUP_ROOT" ]; then
    echo "❌ Error: Backup directory '$BACKUP_ROOT' does not exist."
    exit 1
fi

RETENTION_DAYS=30

echo "🔍 Looking for backups older than $RETENTION_DAYS days in $BACKUP_ROOT..."

# Find and delete .sql and .json files older than RETENTION_DAYS
find "$BACKUP_ROOT" -type f \( -name "*.sql" -o -name "*.json" \) -mtime +$RETENTION_DAYS -exec rm -v {} \;

echo "✅ Backup cleanup complete!"