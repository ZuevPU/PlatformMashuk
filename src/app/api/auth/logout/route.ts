import { NextResponse } from "next/server";
import { destroySession } from "@/lib/auth";

/** Выход: сессия удаляется и в базе, и в cookie. */
export async function POST() {
  await destroySession();
  return NextResponse.json({ ok: true });
}
