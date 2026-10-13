#!/usr/bin/env bash
# Резервное копирование: база PostgreSQL + том загруженных файлов.
# Запуск на сервере:  deploy/backup.sh
# В cron (ежедневно в 03:30):  30 3 * * *  /opt/mashuk/deploy/backup.sh >> /var/log/mashuk-backup.log 2>&1
set -euo pipefail

PROJECT_DIR="${PROJECT_DIR:-$(cd "$(dirname "$0")/.." && pwd)}"
BACKUP_DIR="${BACKUP_DIR:-/var/backups/mashuk}"
RETAIN_DAYS="${RETAIN_DAYS:-7}"

cd "$PROJECT_DIR"
# shellcheck disable=SC1091
set -a; . ./.env; set +a

COMPOSE="docker compose --env-file .env"
mkdir -p "$BACKUP_DIR"
ts="$(date +%Y%m%d-%H%M%S)"

echo "[$(date -Is)] Дамп базы…"
$COMPOSE exec -T db pg_dump \
  -U "${POSTGRES_USER:-mashuk}" \
  -d "${POSTGRES_DB:-mashuk_platform}" \
  | gzip > "$BACKUP_DIR/db-$ts.sql.gz"

echo "[$(date -Is)] Архив загруженных файлов…"
docker run --rm \
  -v mashuk_uploads:/data:ro \
  -v "$BACKUP_DIR":/backup \
  alpine tar czf "/backup/uploads-$ts.tar.gz" -C /data .

echo "[$(date -Is)] Архив сборок программ…"
docker run --rm   -v mashuk_storage:/data:ro   -v "$BACKUP_DIR":/backup   alpine tar czf "/backup/storage-$ts.tar.gz" -C /data .

echo "[$(date -Is)] Ротация старше $RETAIN_DAYS дней…"
find "$BACKUP_DIR" -type f -name '*.gz' -mtime +"$RETAIN_DAYS" -delete

# Необязательно: выгрузка копий во внешнее хранилище (настраивается rclone).
if [ -n "${BACKUP_REMOTE:-}" ] && command -v rclone >/dev/null 2>&1; then
  echo "[$(date -Is)] Выгрузка в $BACKUP_REMOTE…"
  rclone copy "$BACKUP_DIR" "$BACKUP_REMOTE"
fi

echo "[$(date -Is)] Готово: $BACKUP_DIR"
