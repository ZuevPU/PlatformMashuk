import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb, hasDatabase } from "@/lib/db/client";

/**
 * Проверка живости приложения.
 *
 * Используется healthcheck'ом контейнера и внешним мониторингом.
 * Если база подключена, дополнительно проверяется запрос к ней.
 */
export const dynamic = "force-dynamic";

export async function GET() {
  const startedAt = Date.now();
  let database: "ok" | "unavailable" | "skipped" = "skipped";

  if (hasDatabase()) {
    const db = getDb();
    try {
      if (db) {
        await db.execute(sql`select 1`);
        database = "ok";
      }
    } catch {
      database = "unavailable";
    }
  }

  const healthy = database !== "unavailable";

  return NextResponse.json(
    {
      ok: healthy,
      database,
      uptimeSeconds: Math.round(process.uptime()),
      checkedInMs: Date.now() - startedAt,
      version: process.env.APP_VERSION ?? null,
      time: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}
