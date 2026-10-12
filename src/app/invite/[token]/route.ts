import { NextResponse } from "next/server";
import { acceptInviteToken, createSession } from "@/lib/auth";

/**
 * Открытие персональной ссылки-приглашения.
 * Ссылка одноразовая: после входа участник попадает в хаб своей программы.
 */
export async function GET(
  request: Request,
  { params }: { params: Promise<{ token: string }> },
) {
  const { token } = await params;
  const result = await acceptInviteToken(token);

  if (!result) {
    return NextResponse.redirect(new URL("/join?error=invite", request.url));
  }

  await createSession(result.memberId, request.headers.get("user-agent") ?? undefined);

  return NextResponse.redirect(new URL(`/programs/${result.programSlug}/hub`, request.url));
}
