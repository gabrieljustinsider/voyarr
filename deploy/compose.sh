#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
source "$DIR/lib/secrets.sh"

load_env

COMPOSE_FILES=("-f" "docker-compose.base.yml")

if [ "${DATABASE_TARGET:-docker}" = "docker" ]; then
  COMPOSE_FILES+=("-f" "docker-compose.db-docker.yml")
fi

if [ "${FRONTEND_TARGET:-docker}" = "docker" ]; then
  COMPOSE_FILES+=("-f" "docker-compose.frontend-docker.yml")
fi

if [ "${SCRAPER_BROWSER_TARGET:-browserless-io}" = "docker" ]; then
  COMPOSE_FILES+=("-f" "docker-compose.scraper-docker.yml")
fi

if [ "${BACKEND_API_TARGET:-docker}" = "docker" ] && [ "${FRONTEND_TARGET:-docker}" != "docker" ]; then
  COMPOSE_FILES+=("-f" "docker-compose.cloudflare-tunnel.yml")
fi

exec docker compose "${COMPOSE_FILES[@]}" "$@"
