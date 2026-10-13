import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "./schema";

/**
 * Подключение к PostgreSQL.
 *
 * База опциональна: если переменная DATABASE_URL не задана, приложение
 * работает на демонстрационных данных из src/lib/mock и остаётся полностью
 * работоспособным. Это позволяет запускать платформу локально без установки
 * базы данных, а на сервере — включить настоящую.
 */
function createDb(url: string) {
  const client = postgres(url, {
    // Всплеск в зале — 150 ответов на опрос за секунды. Пул должен вмещать его,
    // но оставаться в пределах max_connections Postgres (по умолчанию 100).
    max: Number(process.env.DB_POOL_MAX) || 20,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });
  return drizzle(client, { schema });
}

export type Database = ReturnType<typeof createDb>;

let cached: Database | null = null;

export function databaseUrl(): string | undefined {
  const url = process.env.DATABASE_URL?.trim();
  return url ? url : undefined;
}

export function hasDatabase(): boolean {
  return Boolean(databaseUrl());
}

export function getDb(): Database | null {
  const url = databaseUrl();
  if (!url) return null;
  if (!cached) cached = createDb(url);
  return cached;
}

export { schema };
