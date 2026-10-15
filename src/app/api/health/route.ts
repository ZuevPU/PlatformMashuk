import { NextResponse } from "next/server";
import { sql } from "drizzle-orm";
import { getDb, hasDatabase } from "@/lib/db/client";
import { blobStore } from "@/lib/blob-store";

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
      storage: storageDriver(),
      uptimeSeconds: Math.round(process.uptime()),
      checkedInMs: Date.now() - startedAt,
      version: process.env.APP_VERSION ?? null,
      time: new Date().toISOString(),
    },
    { status: healthy ? 200 : 503 },
  );
}

/** Какое хранилище файлов выбрано: ошибка конфигурации S3 видна сразу, а не при первой загрузке. */
function storageDriver(): string {
  try {
    return blobStore().driver;
  } catch (error) {
    return error instanceof Error ? `ошибка: ${error.message}` : "ошибка";
  }
}
