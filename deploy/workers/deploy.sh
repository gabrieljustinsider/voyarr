#!/usr/bin/env bash
set -euo pipefail

DIR="$(cd "$(dirname "$0")" && pwd)"
PROJECT_DIR="$(cd "$DIR/../.." && pwd)"

source "$PROJECT_DIR/deploy/lib/secrets.sh"
load_env

TARGET="${WORKERS_TARGET:-docker}"

DRIVER="$DIR/$TARGET.sh"
if [ ! -f "$DRIVER" ]; then
  echo "ERROR: No workers driver for target '$TARGET' (expected $DRIVER)" >&2
  exit 1
fi

source "$DRIVER"
deploy_workers
