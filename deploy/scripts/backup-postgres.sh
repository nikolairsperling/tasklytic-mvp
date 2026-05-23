#!/usr/bin/env sh
set -eu

BACKUP_DIR="${BACKUP_DIR:-backups}"
DATABASE_URL="${DATABASE_URL:?DATABASE_URL is required}"

mkdir -p "$BACKUP_DIR"
pg_dump "$DATABASE_URL" > "$BACKUP_DIR/tasklytic-$(date +%F).sql"
find "$BACKUP_DIR" -name "tasklytic-*.sql" -type f -mtime +14 -delete
