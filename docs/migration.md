# Переезд на другой сервер

Переезд = перенести проект, `.env`, базу и файлы, затем переключить домен.

## 1. Подготовка нового сервера
- VPS Ubuntu 24.04, Docker + Compose, swap.
- Клонировать проект в `/opt/mashuk` (см. `deploy-timeweb.md`).
- Скопировать `.env` со старого сервера (там секреты и `AUTH_SECRET` — не меняйте его).

## 2. Перенос данных
Вариант А — через резервные копии (проще):
```bash
# на старом сервере
bash /opt/mashuk/deploy/backup.sh
# скопировать /var/backups/mashuk на новый сервер, затем:
bash /opt/mashuk/deploy/restore.sh db-<дата>.sql.gz uploads-<дата>.tar.gz storage-<дата>.tar.gz
```

Вариант Б — перенос томов Docker напрямую:
```bash
# старый сервер
docker run --rm -v mashuk_pg_data:/data -v "$PWD":/backup alpine \
  tar czf /backup/pg_data.tar.gz -C /data .
# также mashuk_storage и mashuk_uploads
# новый сервер: распаковать в те же тома
docker run --rm -v mashuk_pg_data:/data -v "$PWD":/backup alpine \
  sh -c 'rm -rf /data/* && tar xzf /backup/pg_data.tar.gz -C /data'
```

## 3. Запуск
```bash
cd /opt/mashuk
docker compose --env-file .env up -d
curl -s https://<новый-домен>/api/health
```

## 4. Домен и TLS
- Переключить DNS (A-запись) на IP нового сервера.
- Обновить `DOMAIN` и `ERRORS_DOMAIN` в `.env`.
- Caddy сам выпустит новые сертификаты; старые `caddy_data` переносить не обязательно.

## 5. Проверка
- `/api/health` отвечает `ok`.
- Вход администратора и участника.
- Загруженные фото и сборки программ открываются.
- Отправка сообщения/поста/ответа на опрос сохраняется.

## 6. Откат
Старый сервер не выключайте, пока не убедитесь, что новый работает.
При проблеме верните DNS на старый IP.
