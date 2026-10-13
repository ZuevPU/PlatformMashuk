import { cache } from "react";
import { cookies } from "next/headers";
import { randomBytes } from "node:crypto";
import { and, asc, eq, gt, lt } from "drizzle-orm";
import { getDb, schema } from "./db/client";
import { verifyPassword } from "./password";
import type { Member, MemberRole } from "./types";

/**
 * Вход и сессии.
 *
 * Участник входит по личному логину (почта или телефон) и паролю. Новый
 * участник попадает в программу по паролю программы и сам задаёт личный
 * пароль — см. auth-actions.ts. В браузере лежит только непрозрачный токен
 * сессии в httpOnly-cookie, все данные о пользователе — на сервере.
 */

export const SESSION_COOKIE = "mashuk_session";

const SESSION_DAYS = 30;

export interface SessionUser {
  member: Member;
  /** Администратор Центра: видит все программы и управляет ими */
  isCenterAdmin: boolean;
}

function newToken(): string {
  return randomBytes(32).toString("base64url");
}

function inDays(days: number): Date {
  return new Date(Date.now() + days * 86_400_000);
}

/**
 * Логин в едином виде: почта — строчными буквами, телефон — +7XXXXXXXXXX.
 * Возвращает null, если строка не похожа ни на почту, ни на телефон.
 */
export function normalizeContact(raw: string): string | null {
  const value = raw.trim().toLowerCase();
  if (!value) return null;
  if (value.includes("@")) {
    return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) && value.length <= 200 ? value : null;
  }
  const digits = value.replace(/\D/g, "");
  if (digits.length === 11 && (digits.startsWith("8") || digits.startsWith("7"))) {
    return `+7${digits.slice(1)}`;
  }
  if (digits.length === 10) return `+7${digits}`;
  if (digits.length >= 11 && digits.length <= 15 && value.startsWith("+")) return `+${digits}`;
  return null;
}

/* --- Сессии -------------------------------------------------------------- */

export async function createSession(memberId: string, userAgent?: string): Promise<void> {
  const db = getDb();
  if (!db) throw new Error("База данных не подключена");

  // Прежний вход в этом браузере закрываем: в базе не остаётся «висящих» сессий
  const store = await cookies();
  const previous = store.get(SESSION_COOKIE)?.value;
  if (previous) await db.delete(schema.authSessions).where(eq(schema.authSessions.token, previous));

  const token = newToken();
  await db.insert(schema.authSessions).values({
    token,
    memberId,
    expiresAt: inDays(SESSION_DAYS),
    userAgent: userAgent?.slice(0, 250) ?? null,
  });

  // Попутно убираем истёкшие сессии этого человека
  await db
    .delete(schema.authSessions)
    .where(
      and(eq(schema.authSessions.memberId, memberId), lt(schema.authSessions.expiresAt, new Date())),
    );

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
}

/** Текущий пользователь. Кешируется на время запроса: страница и действия зовут её много раз. */
export const getSessionUser = cache(async (): Promise<SessionUser | null> => {
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
    isCenterAdmin: row.role === "admin",
  };
});

/**
 * Роль участника в конкретной программе — источник прав.
 * Администратор Центра — администратор любой программы.
 */
/**
 * Роль человека в программе и id программы — одним запросом.
 * Администратор Центра — администратор любой программы.
 */
const getProgramAccess = cache(
  async (
    memberId: string,
    programSlug: string,
    isCenterAdmin: boolean,
  ): Promise<{ role: MemberRole; programId: number } | null> => {
    const db = getDb();
    if (!db) return null;

    const [row] = await db
      .select({ programId: schema.programs.id, role: schema.programMembers.role })
      .from(schema.programs)
      .leftJoin(
        schema.programMembers,
        and(
          eq(schema.programMembers.programId, schema.programs.id),
          eq(schema.programMembers.memberId, memberId),
        ),
      )
      .where(eq(schema.programs.slug, programSlug));

    if (!row) return null;
    if (row.role) return { role: row.role, programId: row.programId };
    return isCenterAdmin ? { role: "admin", programId: row.programId } : null;
  },
);

/** Роль участника в конкретной программе — источник прав. */
export async function getProgramRole(memberId: string, programSlug: string): Promise<MemberRole | null> {
  const user = await getSessionUser();
  const access = await getProgramAccess(
    memberId,
    programSlug,
    Boolean(user?.isCenterAdmin && user.member.id === memberId),
  );
  return access?.role ?? null;
}

/** Кто смотрит программу, с какой ролью и в какой программе; null — доступа нет. */
export async function getViewer(
  programSlug: string,
): Promise<{ user: SessionUser; role: MemberRole; programId: number } | null> {
  const user = await getSessionUser();
  if (!user) return null;
  const access = await getProgramAccess(user.member.id, programSlug, user.isCenterAdmin);
  return access ? { user, ...access } : null;
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

/** Удаляет все сессии человека: после смены пароля старые входы перестают работать. */
export async function destroyMemberSessions(memberId: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db.delete(schema.authSessions).where(eq(schema.authSessions.memberId, memberId));
}

/* --- Проверка пароля ----------------------------------------------------- */

/** Проверка личного логина и пароля. Время ответа не зависит от того, есть ли такой логин. */
export async function authenticate(contact: string, password: string): Promise<string | null> {
  const db = getDb();
  if (!db) return null;

  const [row] = await db
    .select({ id: schema.members.id, passwordHash: schema.members.passwordHash })
    .from(schema.members)
    .where(eq(schema.members.contact, contact));

  const ok = await verifyPassword(password, row?.passwordHash ?? null);
  return ok && row ? row.id : null;
}

/** Куда вести после входа: администратора — в админку, участника — в его ближайшую программу. */
export async function homeFor(memberId: string, isCenterAdmin: boolean): Promise<string> {
  if (isCenterAdmin) return "/admin";
  const db = getDb();
  if (!db) return "/";

  const [row] = await db
    .select({ slug: schema.programs.slug })
    .from(schema.programMembers)
    .innerJoin(schema.programs, eq(schema.programs.id, schema.programMembers.programId))
    .where(eq(schema.programMembers.memberId, memberId))
    .orderBy(asc(schema.programs.startDate))
    .limit(1);

  return row ? `/programs/${row.slug}/hub` : "/";
}
