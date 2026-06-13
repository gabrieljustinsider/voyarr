#!/bin/bash

echo "🚀 Starting Voyarr Upgrade & Pre-flight Check..."

# 1. Check if .env exists
if [ ! -f .env ]; then
    echo "❌ Error: .env file not found! Please copy .env.example to .env and configure it."
    exit 1
fi

# 2. Health check for critical environment variables
CRITICAL_VARS=("MASTER_KEY" "SECRET_KEY" "POSTGRES_PASSWORD" "CONFIG_ROOT" "DB_DATA_PATH" "BACKUP_ROOT")
MISSING_VARS=0

for VAR in "${CRITICAL_VARS[@]}"; do
    # Safely extract the value, stripping out quotes and whitespace
    VAL=$(grep "^${VAR}=" .env | cut -d '=' -f2- | tr -d ' "' | tr -d "'")
    if [ -z "$VAL" ]; then
        echo "❌ Error: Required environment variable '$VAR' is missing or empty in .env!"
        MISSING_VARS=1
    fi
done

if [ $MISSING_VARS -eq 1 ]; then
    echo "⚠️  Please update your .env file with the missing variables before proceeding."
    exit 1
fi

echo "✅ Environment variables verified."

# 3. Perform pre-upgrade database backup
echo "📦 Checking database status for pre-upgrade backup..."

# Only attempt a backup if the voyarr-db container is currently running
if docker ps --format '{{.Names}}' | grep -q "^voyarr-db$"; then
    TIMESTAMP=$(date +"%Y%m%d_%H%M%S")
    BACKUP_FILE="/backups/pre_upgrade_${TIMESTAMP}.sql"
    
    # Extract credentials from .env or use defaults
    DB_USER=$(grep "^POSTGRES_USER=" .env | cut -d '=' -f2- | tr -d ' "' | tr -d "'")
    DB_USER=${DB_USER:-voyarr_user}
    
    DB_NAME=$(grep "^POSTGRES_DB=" .env | cut -d '=' -f2- | tr -d ' "' | tr -d "'")
    DB_NAME=${DB_NAME:-voyarr}
    
    echo "💾 Backing up database to $BACKUP_FILE (inside the backups volume)..."
    docker compose exec -T db bash -c "pg_dump -U \"$DB_USER\" -d \"$DB_NAME\" > \"$BACKUP_FILE\""
    
    if [ $? -eq 0 ]; then
        echo "✅ Database backup successful!"
    else
        echo "⚠️  Database backup failed! Aborting upgrade to protect data."
        exit 1
    fi
else
    echo "⚠️  Database container (voyarr-db) is not currently running. Skipping live backup."
fi

# 4. Pull and upgrade containers
echo "🔄 Pulling latest images..."
docker compose pull
echo "🚀 Starting updated containers..."
docker compose up -d

echo "🎉 Voyarr upgrade complete!"