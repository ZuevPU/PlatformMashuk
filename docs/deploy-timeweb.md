# Деплой на Timeweb

## Что нужно
- VPS Timeweb, Ubuntu 24.04, минимум 2 vCPU / 4 ГБ, диск от 40 ГБ.
- Домен (или технический `IP.sslip.io`, который резолвится на сервер).
- Docker и Compose на сервере, открытые порты 80/443.

## Схема
- Образы собираются в **GitHub Actions** и публикуются в `ghcr.io`.
- На сервере в `/opt/mashuk` лежит git-копия проекта и файл `.env`.
- `deploy/autoupdate.sh` по cron каждые 5 минут подтягивает `main`, новые образы,
  применяет миграции и перезапускает приложение. Входящий SSH из CI не нужен.

## Первый запуск
```bash
sudo apt update && sudo apt install -y docker.io docker-compose-v2 git
sudo usermod -aG docker "$USER"
sudo fallocate -l 2G /swapfile && sudo chmod 600 /swapfile
sudo mkswap /swapfile && sudo swapon /swapfile
echo '/swapfile none swap sw 0 0' | sudo tee -a /etc/fstab

sudo mkdir -p /opt/mashuk && sudo chown "$USER" /opt/mashuk
git clone https://github.com/ZuevPU/PlatformMashuk.git /opt/mashuk
cd /opt/mashuk
cp deploy/.env.production.example .env   # затем заполнить .env
```

`.env` (минимум): `DOMAIN`, `ACME_EMAIL`, `POSTGRES_USER`, `POSTGRES_PASSWORD`,
`POSTGRES_DB`, `AUTH_SECRET`, `GF_SECURITY_ADMIN_PASSWORD`,
`APP_IMAGE=ghcr.io/zuevpu/platformmashuk:latest`,
`TOOLS_IMAGE=ghcr.io/zuevpu/platformmashuk-tools:latest`.
Для GlitchTip добавьте `ERRORS_DOMAIN` и `GLITCHTIP_SECRET_KEY`.

Первый запуск:
```bash
docker compose --env-file .env up -d
docker compose --env-file .env --profile tools run --rm tools pnpm db:migrate
# при необходимости демо-данных:
SEED_FORCE=1 docker compose --env-file .env --profile tools run --rm tools pnpm db:seed
```

Cron (`crontab deploy/cron.txt`):
```
30 3 * * * bash /opt/mashuk/deploy/backup.sh >> /var/log/mashuk-backup.log 2>&1
*/5 * * * * bash /opt/mashuk/deploy/autoupdate.sh >> /var/log/mashuk-autoupdate.log 2>&1
```

## Проверка
- `https://DOMAIN/api/health` → `{"ok":true,"database":"ok",...}`
- Вход администратора: `/join`, затем `/admin`.
- Вход участника по паролю программы: `/programs/<slug>/enter`.

## Обновления
Пуш в `main` → GitHub Actions собирает и публикует образы → сервер подтягивает их
в течение 5 минут (или вручную: `bash /opt/mashuk/deploy/autoupdate.sh`).

## Резервные копии
```bash
bash /opt/mashuk/deploy/backup.sh     # база + загруженные файлы + сборки
bash /opt/mashuk/deploy/restore.sh <db.sql.gz> [uploads.tar.gz] [storage.tar.gz]
```

## Мониторинг
- GlitchTip: `https://errors.<DOMAIN>` (Sentry-совместимый приём ошибок).
- Метрики (Prometheus/Grafana) включаются профилем:
  `docker compose --env-file .env --profile metrics up -d`.
