#!/usr/bin/env bash
# Create the local MySQL database, user and schema for dev and tests.
#
# Dev and production run the SAME engine on purpose: the dialects disagree in
# ways that pass every test and then fail in the pod. `meeting_id IS ?` is
# valid SQLite and a syntax error in MySQL, and it shipped broken while every
# test stayed green.
#
# Idempotent. Re-run it after editing sql/schema.mysql.sql.
#
#   brew services start mysql
#   npm run db:setup
set -euo pipefail

DB="${APP_ID:-fellow_dev}"
USER="app_${DB}"
PASS="${DB_PASSWORD:-fellowdev}"

if ! command -v mysql >/dev/null 2>&1; then
  export PATH="/opt/homebrew/opt/mysql/bin:$PATH"
fi
if ! command -v mysql >/dev/null 2>&1; then
  echo "mysql client not found. Install with: brew install mysql" >&2
  exit 1
fi
if ! mysqladmin ping --silent >/dev/null 2>&1; then
  echo "MySQL is not running. Start it with: brew services start mysql" >&2
  exit 1
fi

# The app derives both the schema name and the user from APP_ID, exactly as
# Protoship does, so local dev exercises the production code path unchanged.
mysql -u root <<SQL
CREATE DATABASE IF NOT EXISTS \`${DB}\` CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci;
CREATE USER IF NOT EXISTS '${USER}'@'localhost' IDENTIFIED BY '${PASS}';
CREATE USER IF NOT EXISTS '${USER}'@'127.0.0.1' IDENTIFIED BY '${PASS}';
GRANT ALL PRIVILEGES ON \`${DB}\`.* TO '${USER}'@'localhost';
GRANT ALL PRIVILEGES ON \`${DB}\`.* TO '${USER}'@'127.0.0.1';
FLUSH PRIVILEGES;
SQL

mysql -u root "${DB}" < "$(dirname "$0")/../sql/schema.mysql.sql"

echo "Ready: ${DB} (user ${USER})"
