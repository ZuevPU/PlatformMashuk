import { cookies } from "next/headers";
import { randomInt, randomUUID } from "node:crypto";
import { and, asc, eq, gt, ne } from "drizzle-orm";
import { getDb, schema } from "./db/client";
import type { Member, MemberRole } from "./types";

/**
 * Вход по приглашению: персональная ссылка, код на почту или код в SMS.
 *
 * Паролей нет. В браузере лежит только непрозрачный токен сессии,
 * все данные о пользователе — на сервере.
 */

export const SESSION_COOKIE = "mashuk_session";
const SESSION_DAYS = 30;
const CODE_TTL_MINUTES = 20;
const INVITE_TTL_DAYS = 60;

export interface SessionUser {
  member: Member;
  /** Программы участника и его роль в каждой */
  programs: { slug: string; role: MemberRole }[];
}

function newToken(): string {
  return randomUUID().replace(/-/g, "") + randomUUID().replace(/-/g, "").slice(0, 16);
}

function code(): string {
  return String(randomInt(100000, 999999));
}

function inDays(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
}

/* --- Сессии -------------------------------------------------------------- */

export async function createSession(memberId: string, userAgent?: string): Promise<string> {
  const db = getDb();
  if (!db) throw new Error("База данных не подключена");

  const token = newToken();
  await db.insert(schema.authSessions).values({
    token,
    memberId,
    expiresAt: inDays(SESSION_DAYS),
    userAgent: userAgent?.slice(0, 250) ?? null,
  });

  const store = await cookies();
  store.set(SESSION_COOKIE, token, {
    httpOnly: true,
    sameSite: "lax",
    // В рабочей версии cookie только по HTTPS. Для локальной проверки
    // production-сборки по http:// разрешается флагом ALLOW_INSECURE_COOKIES=1.
    secure:
      process.env.NODE_ENV === "production" && process.env.ALLOW_INSECURE_COOKIES !== "1",
    path: "/",
    maxAge: SESSION_DAYS * 86_400,
  });

  return token;
}

export async function getSessionUser(): Promise<SessionUser | null> {
  const db = getDb();
  if (!db) return null;

  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;
  if (!token) return null;

  const [row] = await db
    .select({
      memberId: schema.members.id,
      name: schema.members.name,
      role: schema.members.role,
      position: schema.members.position,
      org: schema.members.org,
      city: schema.members.city,
    })
    .from(schema.authSessions)
    .innerJoin(schema.members, eq(schema.members.id, schema.authSessions.memberId))
    .where(
      and(eq(schema.authSessions.token, token), gt(schema.authSessions.expiresAt, new Date())),
    );

  if (!row) return null;

  return {
    member: {
      id: row.memberId,
      name: row.name,
      role: row.role,
      position: row.position ?? undefined,
      org: row.org ?? undefined,
      city: row.city ?? undefined,
    },
    programs: [],
  };
}

/** Роль участника в конкретной программе — источник прав в интерфейсе. */
export async function getProgramRole(
  memberId: string,
  programSlug: string,
): Promise<MemberRole | null> {
  const db = getDb();
  if (!db) return null;

  const [row] = await db
    .select({ role: schema.programMembers.role })
    .from(schema.programMembers)
    .innerJoin(schema.programs, eq(schema.programs.id, schema.programMembers.programId))
    .where(
      and(
        eq(schema.programMembers.memberId, memberId),
        eq(schema.programs.slug, programSlug),
      ),
    );

  return row?.role ?? null;
}

export async function destroySession(): Promise<void> {
  const db = getDb();
  const store = await cookies();
  const token = store.get(SESSION_COOKIE)?.value;

  if (db && token) {
    await db.delete(schema.authSessions).where(eq(schema.authSessions.token, token));
  }
  store.delete(SESSION_COOKIE);
}

/* --- Приглашения --------------------------------------------------------- */

export async function createInvite(input: {
  programId: number;
  memberId: string;
  channel: "link" | "email" | "sms";
  contact?: string;
}): Promise<string> {
  const db = getDb();
  if (!db) throw new Error("База данных не подключена");

  const token = newToken();
  await db.insert(schema.invites).values({
    token,
    programId: input.programId,
    memberId: input.memberId,
    channel: input.channel,
    contact: input.contact ?? null,
    expiresAt: inDays(INVITE_TTL_DAYS),
  });

  return token;
}

export interface InviteResult {
  memberId: string;
  programSlug: string;
  programTitle: string;
}

/** Первая программа участника — куда вести после входа. */
async function firstProgramForMember(memberId: string): Promise<InviteResult | null> {
  const db = getDb();
  if (!db) return null;

  const [row] = await db
    .select({ programSlug: schema.programs.slug, programTitle: schema.programs.title })
    .from(schema.programMembers)
    .innerJoin(schema.programs, eq(schema.programs.id, schema.programMembers.programId))
    .where(eq(schema.programMembers.memberId, memberId))
    .orderBy(asc(schema.programs.startDate))
    .limit(1);

  if (!row) return null;
  return { memberId, programSlug: row.programSlug, programTitle: row.programTitle };
}

/** Открытие персональной ссылки: приглашение помечается использованным. */
export async function acceptInviteToken(token: string): Promise<InviteResult | null> {
  const db = getDb();
  if (!db) return null;

  const [row] = await db
    .select({
      memberId: schema.invites.memberId,
      status: schema.invites.status,
      expiresAt: schema.invites.expiresAt,
      programSlug: schema.programs.slug,
      programTitle: schema.programs.title,
    })
    .from(schema.invites)
    .leftJoin(schema.programs, eq(schema.programs.id, schema.invites.programId))
    .where(eq(schema.invites.token, token));

  if (!row) return null;
  if (row.status === "revoked") return null;
  if (row.expiresAt.getTime() < Date.now()) return null;

  await db
    .update(schema.invites)
    .set({ status: "used", usedAt: new Date() })
    .where(eq(schema.invites.token, token));

  if (row.programSlug && row.programTitle) {
    return { memberId: row.memberId, programSlug: row.programSlug, programTitle: row.programTitle };
  }

  return firstProgramForMember(row.memberId);
}

/**
 * Запрос кода на почту или телефон.
 *
 * Провайдер рассылки подключается отдельно: пока код возвращается в ответе
 * только вне production, чтобы вход можно было проверить без почтового сервиса.
 */
export async function requestLoginCode(
  contact: string,
): Promise<{ ok: boolean; devCode?: string; reason?: string }> {
  const db = getDb();
  if (!db) return { ok: false, reason: "База данных не подключена" };

  const normalized = contact.trim().toLowerCase();
  if (!normalized) return { ok: false, reason: "Укажите почту или телефон" };

  const [row] = await db
    .select({ token: schema.invites.token, memberId: schema.invites.memberId })
    .from(schema.invites)
    .where(
      and(eq(schema.invites.contact, normalized), ne(schema.invites.status, "revoked")),
    )
    .limit(1);

  if (!row) {
    return { ok: false, reason: "Приглашение для этого адреса не найдено" };
  }

  const value = code();
  await db
    .update(schema.invites)
    .set({ code: value, channel: normalized.includes("@") ? "email" : "sms" })
    .where(eq(schema.invites.token, row.token));

  return {
    ok: true,
    devCode: process.env.NODE_ENV === "production" ? undefined : value,
  };
}

/** Проверка кода и выдача сессии. */
export async function verifyLoginCode(
  contact: string,
  value: string,
): Promise<{ memberId: string } | null> {
  const db = getDb();
  if (!db) return null;

  const normalized = contact.trim().toLowerCase();
  const [row] = await db
    .select({
      token: schema.invites.token,
      memberId: schema.invites.memberId,
      code: schema.invites.code,
      createdAt: schema.invites.createdAt,
    })
    .from(schema.invites)
    .where(and(eq(schema.invites.contact, normalized), eq(schema.invites.code, value.trim())))
    .limit(1);

  if (!row) return null;
  if (Date.now() - row.createdAt.getTime() > CODE_TTL_MINUTES * 60_000) return null;

  // Код одноразовый, но приглашение остаётся действующим: участник может
  // потерять сессию и запросить новый код — статус при этом не сжигается.
  await db
    .update(schema.invites)
    .set({ code: null, usedAt: new Date() })
    .where(eq(schema.invites.token, row.token));

  return { memberId: row.memberId };
}
