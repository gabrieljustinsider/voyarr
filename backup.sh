#!/bin/bash

echo "🚀 Starting Voyarr Database Backup..."

# 1. Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found! Please copy .env.example to .env and configure it."
    exit 1
fi

# 2. Perform live database backup
if docker ps --format '{{.Names}}' | grep -q "^voyarr-db$"; then
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    BACKUP_FILE="/backups/manual_db_backup_${TIMESTAMP}.sql"
    
    DB_USER=$(grep "^POSTGRES_USER=" .env | cut -d '=' -f2- | tr -d ' "' | tr -d "'")
    DB_USER=${DB_USER:-voyarr_user}
    
    DB_NAME=$(grep "^POSTGRES_DB=" .env | cut -d '=' -f2- | tr -d ' "' | tr -d "'")
    DB_NAME=${DB_NAME:-voyarr}
    
    echo "💾 Backing up database to $BACKUP_FILE (inside the backups volume)..."
    docker compose exec -T db bash -c "pg_dump -U \"$DB_USER\" -d \"$DB_NAME\" > \"$BACKUP_FILE\""
    
    if [ $? -eq 0 ]; then
        echo "✅ Database backup successful!"
    fi
else
    echo "❌ Error: Database container (voyarr-db) is not currently running. Cannot perform backup."
    exit 1
fi