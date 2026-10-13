import { NextResponse } from "next/server";
import { getHubAccess, loadHubPart } from "@/lib/hub-data";
import { loadPollData } from "@/lib/db/queries";
import type { HubPart } from "@/lib/hub-data";

/**
 * Свежая часть данных хаба: канал, чаты, опросы или состав.
 *
 * Браузер получает живое событие и забирает только изменившуюся часть —
 * страница целиком не перерисовывается.
 */

const PARTS: HubPart[] = ["channel", "chats", "polls", "members"];

export async function GET(request: Request, { params }: { params: Promise<{ part: string }> }) {
  const { part } = await params;
  if (!PARTS.includes(part as HubPart)) {
    return NextResponse.json({ ok: false, error: "Неизвестный раздел" }, { status: 404 });
  }

  const programSlug = new URL(request.url).searchParams.get("program") ?? "";
  const access = await getHubAccess(programSlug);
  if (!access) {
    return NextResponse.json({ ok: false, error: "Нет доступа к программе" }, { status: 403 });
  }

  // Живой опрос: только одна сессия — без прошлых опросов программы
  const sessionId = new URL(request.url).searchParams.get("session");
  const data =
    part === "polls" && sessionId && /^[\w-]{1,120}$/.test(sessionId)
      ? await loadPollData(access.programId, access.programSlug, access.viewer, sessionId)
      : await loadHubPart(part as HubPart, access);
  return NextResponse.json(
    { ok: true, data },
    { headers: { "cache-control": "private, no-store" } },
  );
}
