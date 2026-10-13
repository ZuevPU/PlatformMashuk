import { headers } from "next/headers";
import { eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "./db/client";

/**
 * Ограничение попыток входа — защита от перебора паролей.
 *
 * Счётчики хранятся в базе, поэтому переживают перезапуск приложения.
 * Каждая неудачная попытка увеличивает счётчик ключа в окне; при превышении
 * лимита ключ блокируется. Успешный вход сбрасывает счётчик.
 */

export interface Limit {
  /** Сколько неудачных попыток разрешено в окне */
  max: number;
  windowMinutes: number;
  blockMinutes: number;
}

export const LOGIN_LIMIT: Limit = { max: 8, windowMinutes: 15, blockMinutes: 15 };
export const IP_LIMIT: Limit = { max: 40, windowMinutes: 15, blockMinutes: 30 };

/** Адрес клиента: Caddy передаёт его в X-Forwarded-For. */
export async function clientIp(): Promise<string> {
  const list = await headers();
  const forwarded = list.get("x-forwarded-for")?.split(",")[0]?.trim();
  return forwarded || list.get("x-real-ip") || "local";
}

/** Заблокирован ли хотя бы один из ключей. Возвращает минуты до разблокировки. */
export async function blockedFor(keys: string[]): Promise<number> {
  const db = getDb();
  if (!db || keys.length === 0) return 0;
  const rows = await db
    .select({ blockedUntil: schema.loginAttempts.blockedUntil })
    .from(schema.loginAttempts)
    .where(inArray(schema.loginAttempts.key, keys));
  const now = Date.now();
  const until = Math.max(0, ...rows.map((row) => row.blockedUntil?.getTime() ?? 0));
  return until > now ? Math.ceil((until - now) / 60_000) : 0;
}

/** Учитывает неудачную попытку по каждому ключу. */
export async function recordFailure(entries: { key: string; limit: Limit }[]): Promise<void> {
  const db = getDb();
  if (!db) return;
  for (const { key, limit } of entries) {
    // Окно истекло — счёт начинается заново; иначе счётчик растёт.
    // Блокировка ставится в том же запросе, без гонки между чтением и записью.
    await db.execute(sql`
      insert into login_attempts (key, attempts, window_start, blocked_until)
      values (${key}, 1, now(), null)
      on conflict (key) do update set
        attempts = case
          when login_attempts.window_start < now() - make_interval(mins => ${limit.windowMinutes})
          then 1 else login_attempts.attempts + 1 end,
        window_start = case
          when login_attempts.window_start < now() - make_interval(mins => ${limit.windowMinutes})
          then now() else login_attempts.window_start end,
        blocked_until = case
          when login_attempts.window_start >= now() - make_interval(mins => ${limit.windowMinutes})
           and login_attempts.attempts + 1 >= ${limit.max}
          then now() + make_interval(mins => ${limit.blockMinutes})
          else login_attempts.blocked_until end
    `);
  }
}

export async function resetAttempts(keys: string[]): Promise<void> {
  const db = getDb();
  if (!db) return;
  for (const key of keys) {
    await db.delete(schema.loginAttempts).where(eq(schema.loginAttempts.key, key));
  }
}
