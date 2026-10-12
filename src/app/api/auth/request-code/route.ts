import { NextResponse } from "next/server";
import { hasDatabase } from "@/lib/db/client";
import { requestLoginCode } from "@/lib/auth";

/** Запрос одноразового кода на почту или телефон. */
export async function POST(request: Request) {
  if (!hasDatabase()) {
    return NextResponse.json(
      { ok: false, reason: "Вход подключается вместе с базой данных" },
      { status: 503 },
    );
  }

  const body = (await request.json().catch(() => ({}))) as { contact?: string };
  const result = await requestLoginCode(body.contact ?? "");

  return NextResponse.json(result, { status: result.ok ? 200 : 400 });
}
