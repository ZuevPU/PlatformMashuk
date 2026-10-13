#!/usr/bin/env bash
# Восстановление из резервной копии.
#   deploy/restore.sh /var/backups/mashuk/db-20260101-033000.sql.gz [uploads-….tar.gz] [storage-….tar.gz]
# ВНИМАНИЕ: существующие данные базы, загруженные файлы и сборки программ будут перезаписаны.
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
DB_FILE="${1:?Укажите путь к дампу базы .sql.gz}"
UP_FILE="${2:-}"
STORAGE_FILE="${3:-}"

cd "$PROJECT_DIR"
# shellcheck disable=SC1091
set -a; . ./.env; set +a

COMPOSE="docker compose --env-file .env"

echo "[$(date -Is)] Восстановление базы из $DB_FILE…"
gunzip -c "$DB_FILE" | $COMPOSE exec -T db psql \
  -U "${POSTGRES_USER:-mashuk}" \
  -d "${POSTGRES_DB:-mashuk_platform}"

if [ -n "$UP_FILE" ]; then
  echo "[$(date -Is)] Восстановление файлов из $UP_FILE…"
  UP_DIR="$(cd "$(dirname "$UP_FILE")" && pwd)"
  UP_NAME="$(basename "$UP_FILE")"
  docker run --rm \
    -v mashuk_uploads:/data \
    -v "$UP_DIR":/backup:ro \
    alpine sh -c "rm -rf /data/* && tar xzf '/backup/$UP_NAME' -C /data"
fi

if [ -n "$STORAGE_FILE" ]; then
  echo "[$(date -Is)] Восстановление сборок программ из $STORAGE_FILE…"
  ST_DIR="$(cd "$(dirname "$STORAGE_FILE")" && pwd)"
  ST_NAME="$(basename "$STORAGE_FILE")"
  docker run --rm     -v mashuk_storage:/data     -v "$ST_DIR":/backup:ro     alpine sh -c "rm -rf /data/* && tar xzf '/backup/$ST_NAME' -C /data"
fi

echo "[$(date -Is)] Готово. Перезапустите приложение: docker compose up -d"
