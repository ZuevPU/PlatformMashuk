import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db/client";
import { createSession, verifyLoginCode } from "@/lib/auth";

/** Проверка кода и вход: в ответ уходит только результат, токен остаётся в cookie. */
export async function POST(request: Request) {
  if (!hasDatabase()) {
    return NextResponse.json(
      { ok: false, reason: "Вход подключается вместе с базой данных" },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { contact?: string; code?: string };
  const result = await verifyLoginCode(body.contact ?? "", body.code ?? "");

  if (!result) {
    return NextResponse.json({ ok: false, reason: "Код не подошёл или устарел" }, { status: 400 });
  }

  await createSession(result.memberId, request.headers.get("user-agent") ?? undefined);

  return NextResponse.json({ ok: true, memberId: result.memberId });
}
