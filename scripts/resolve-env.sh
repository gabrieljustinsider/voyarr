#!/usr/bin/env bash
set -euo pipefail

PROJECT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
SRC="$PROJECT_DIR/.env"
OUT="$PROJECT_DIR/.env.portainer"

if ! command -v op >/dev/null 2>&1; then
  echo "ERROR: 1Password CLI ('op') not found. Install it first." >&2
  exit 1
fi

echo "Resolving $SRC -> $OUT"
op inject --force --in-file "$SRC" --out-file "$OUT"

echo "Done. $OUT is ready for build/deploy. Delete it when not in use."