import { NextResponse } from "next/server";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { getProgramRole, getSessionUser } from "@/lib/auth";

/**
 * Состояние живой сессии опроса.
 *
 * Пока вместо WebSocket используется короткий опрос: участник и ведущий
 * раз в несколько секунд спрашивают сервер, что происходит. Интерфейс
 * не зависит от транспорта — при переходе на Socket.IO этот маршрут
 * останется как резервный.
 */
export async function GET(request: Request) {
  const db = getDb();
  if (!db) {
    return NextResponse.json({ ok: false, error: "Демонстрационный режим" }, { status: 503 });
  }

  const url = new URL(request.url);
  const programSlug = url.searchParams.get("program") ?? "";
  const sessionId = url.searchParams.get("session") ?? "";

  const user = await getSessionUser();
  if (!user) {
    return NextResponse.json({ ok: false, error: "Нужно войти" }, { status: 401 });
  }

  const role = await getProgramRole(user.member.id, programSlug);
  if (!role) {
    return NextResponse.json({ ok: false, error: "Нет доступа к программе" }, { status: 403 });
  }

  const [row] = await db
    .select({
      status: schema.pollSessions.status,
      currentIndex: schema.pollSessions.currentIndex,
      accepting: schema.pollSessions.accepting,
      showResults: schema.pollSessions.showResults,
      code: schema.pollSessions.code,
      pollId: schema.pollSessions.pollId,
    })
    .from(schema.pollSessions)
    .innerJoin(schema.polls, eq(schema.polls.id, schema.pollSessions.pollId))
    .innerJoin(schema.programs, eq(schema.programs.id, schema.polls.programId))
    .where(and(eq(schema.pollSessions.id, sessionId), eq(schema.programs.slug, programSlug)));

  if (!row) {
    return NextResponse.json({ ok: false, error: "Сессия не найдена" }, { status: 404 });
  }

  return NextResponse.json({
    ok: true,
    status: row.status,
    currentIndex: row.currentIndex,
    accepting: row.accepting,
    showResults: row.showResults,
    code: row.code,
  });
}
