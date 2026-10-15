#!/usr/bin/env bash
# Автообновление сервера: подтягивает конфигурацию из git (main) и образы из
# ghcr.io, при изменениях перезапускает стек и применяет миграции.
# Входящий SSH из CI не нужен — меньше точек отказа.
#
# Запускается по cron каждые 5 минут (вызов через bash, exec-бит в git не хранится):
#   */5 * * * * bash /opt/mashuk/deploy/autoupdate.sh >> /var/log/mashuk-autoupdate.log 2>&1
set -euo pipefail

cd /opt/mashuk || exit 1
# shellcheck disable=SC1091
set -a; . ./.env; set +a

COMPOSE="docker compose --env-file .env"

config_hash() {
  cat docker-compose.yml deploy/Caddyfile 2>/dev/null | sha256sum | cut -d' ' -f1
}

cfg_before="$(config_hash)"
img_before="$(docker image inspect --format '{{.Id}}' "$APP_IMAGE" 2>/dev/null || true)"

# Обновляем конфигурацию из git: .env и тома не трогаются
git fetch --prune origin main >/dev/null 2>&1 || true
git checkout -B main FETCH_HEAD >/dev/null 2>&1 || true
git reset --hard FETCH_HEAD >/dev/null 2>&1 || true

$COMPOSE pull -q app tools >/dev/null 2>&1 || true

cfg_after="$(config_hash)"
img_after="$(docker image inspect --format '{{.Id}}' "$APP_IMAGE" 2>/dev/null || true)"

# Ни образ, ни конфигурация не изменились — ничего не делаем
if [ "$cfg_before" = "$cfg_after" ] && [ -n "$img_before" ] && [ "$img_before" = "$img_after" ]; then
  exit 0
fi

echo "[$(date -Is)] Обновление: изменились образ или конфигурация"
$COMPOSE run --rm tools pnpm db:migrate
$COMPOSE up -d --remove-orphans
docker image prune -f >/dev/null 2>&1 || true
echo "[$(date -Is)] Готово"
