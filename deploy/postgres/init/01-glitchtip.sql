-- Дополнительные базы при первом запуске PostgreSQL.
-- Основную базу создаёт POSTGRES_DB; здесь — база для GlitchTip,
-- чтобы не поднимать второй сервер PostgreSQL на слабом VPS.

CREATE DATABASE glitchtip;
