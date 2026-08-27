#!/bin/sh

set -eu

SCRIPT_DIR=$(CDPATH= cd -- "$(dirname -- "$0")" && pwd)
PROJECT_ROOT=$(dirname -- "$SCRIPT_DIR")
TOKEN_FILE="$PROJECT_ROOT/.env.apifox.local"

if [ -f "$TOKEN_FILE" ]; then
  set -a
  . "$TOKEN_FILE"
  set +a
fi

if [ -z "${APIFOX_ACCESS_TOKEN:-}" ]; then
  echo "APIFOX_ACCESS_TOKEN is not configured. Set it in the environment or .env.apifox.local." >&2
  exit 1
fi

NPX_BIN="${NPX_BIN:-/opt/homebrew/bin/npx}"
if [ ! -x "$NPX_BIN" ]; then
  NPX_BIN=$(command -v npx || true)
fi

if [ -z "$NPX_BIN" ]; then
  echo "npx was not found. Install Node.js 18 or newer." >&2
  exit 1
fi

exec "$NPX_BIN" -y apifox-mcp-server@latest --project=8679942

