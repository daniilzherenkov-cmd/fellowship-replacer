#!/usr/bin/env bash
# Boot the REAL production artifact locally and probe it.
#
# This is the cheap stand-in for building the Docker image, and it catches the
# failure class that has actually taken this app down: the image builds fine,
# CI goes green, and the pod then never becomes ready so the edge serves
# "no healthy upstream".
#
# It runs `.next/standalone/server.js` FROM / on purpose. GDP does not preserve
# the image's WORKDIR, so a relative CMD dies with
# "Cannot find module '/server.js'". Running from / reproduces that exactly.
#
# WHAT THIS DOES NOT COVER (know the gap):
#   - Node version: local is whatever you have, the image is node:20-alpine.
#   - libc: macOS/arm64 here, musl there. Only matters with native modules,
#     and there are none in the graph today.
#   - Vault, Cloudflare Access and the platform MySQL are not replicated.
# If you add a native dependency or change the Node version, this stops being
# a sufficient substitute and a real container build is worth the trouble.
#
#   npm run smoke
set -euo pipefail

PORT="${SMOKE_PORT:-3211}"
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
SERVER="$ROOT/.next/standalone/server.js"

if ! command -v mysql >/dev/null 2>&1; then export PATH="/opt/homebrew/opt/mysql/bin:$PATH"; fi
if ! mysqladmin ping --silent >/dev/null 2>&1; then
  echo "MySQL is not running. Start it with: brew services start mysql" >&2
  exit 1
fi

if [ ! -f "$SERVER" ]; then
  echo "No standalone build found. Running npm run build first."
  (cd "$ROOT" && npm run build)
fi

echo "Booting the standalone server from / on port $PORT"
cd /
PORT="$PORT" \
FELLOW_DB_DRIVER=mysql \
APP_ID="${APP_ID:-fellow_dev}" \
DB_HOST="${DB_HOST:-127.0.0.1}" \
DB_PORT="${DB_PORT:-3306}" \
DB_PASSWORD="${DB_PASSWORD:-fellowdev}" \
FELLOW_ENCRYPTION_KEY="${FELLOW_ENCRYPTION_KEY:-local-smoke-key-long-enough-for-testing}" \
  node "$SERVER" > /tmp/fellow-smoke.log 2>&1 &
PID=$!
trap 'kill "$PID" 2>/dev/null || true' EXIT

for _ in $(seq 1 30); do
  code=$(curl -s -o /dev/null -w '%{http_code}' "http://127.0.0.1:$PORT/api/health" 2>/dev/null || echo 000)
  [ "$code" = "200" ] && break
  sleep 1
done

if [ "${code:-000}" != "200" ]; then
  echo "FAILED: /api/health returned ${code:-no response}. This is what a dead pod looks like." >&2
  echo "--- server log ---" >&2
  cat /tmp/fellow-smoke.log >&2
  exit 1
fi

echo "OK: /api/health returned 200"
curl -s "http://127.0.0.1:$PORT/api/health"
echo
