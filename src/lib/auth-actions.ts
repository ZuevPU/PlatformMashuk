"use server";

import { randomUUID } from "node:crypto";
import { headers } from "next/headers";
import { redirect } from "next/navigation";
import { revalidatePath } from "next/cache";
import { eq } from "drizzle-orm";
import { getDb, schema } from "./db/client";
import { publish } from "./events";
import {
  authenticate,
  createSession,
  destroyMemberSessions,
  destroySession,
  getSessionUser,
  homeFor,
  normalizeContact,
} from "./auth";
import { hashPassword, passwordProblem, verifyPassword } from "./password";
import { joinGeneralChats } from "./general-chat";
import {
  IP_LIMIT,
  LOGIN_LIMIT,
  blockedFor,
  clientIp,
  recordFailure,
  resetAttempts,
} from "./rate-limit";

/**
 * Вход на платформу.
 *
 * Два пути, оба ведут к личной сессии:
 *  1. личный логин (почта или телефон) и пароль;
 *  2. пароль программы → человек представляется и задаёт личный пароль.
 *     Так создаётся только новая запись: к существующей (в том числе заведённой
 *     администратором) пароль программы доступа не даёт.
 *
 * Ошибки намеренно одинаковые: по ответу нельзя узнать, есть ли такой логин.
 */

export interface FormState {
  error?: string;
  /** Сообщение об успехе — форма показывает подтверждение */
  ok?: string;
  /** Введённое (кроме паролей) — форма восстанавливает его после ошибки */
  values?: Record<string, string>;
}

/** Ошибка формы с сохранением введённых полей. */
function failWith(form: FormData, error: string, names: string[]): FormState {
  return { error, values: Object.fromEntries(names.map((name) => [name, field(form, name, 300)])) };
}

const LOGIN_FIELDS = ["contact"];
const ENTER_FIELDS = ["name", "contact", "position", "org", "city"];

const GENERIC_LOGIN_ERROR = "Неверный логин или пароль";

function field(form: FormData, name: string, max = 200): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

/** Разрешаем возврат только на свои страницы: защита от открытого редиректа. */
function safeNext(value: string): string | null {
  return value.startsWith("/") && !value.startsWith("//") && !value.includes("\\") ? value : null;
}

function blockedMessage(minutes: number): string {
  return `Слишком много попыток. Попробуйте через ${minutes} мин.`;
}

async function userAgent(): Promise<string | undefined> {
  return (await headers()).get("user-agent") ?? undefined;
}

/* --- Вход по личному паролю ---------------------------------------------- */

export async function loginAction(_: FormState, form: FormData): Promise<FormState> {
  if (!getDb()) return failWith(form, "Вход появится после подключения базы данных", LOGIN_FIELDS);

  const contact = normalizeContact(field(form, "contact"));
  const password = field(form, "password", 200);
  const next = safeNext(field(form, "next", 300));

  if (!contact || !password) return failWith(form, "Введите логин и пароль", LOGIN_FIELDS);

  const ip = await clientIp();
  const keys = [`login:ip:${ip}`, `login:contact:${contact}`];
  const blocked = await blockedFor(keys);
  if (blocked) return failWith(form, blockedMessage(blocked), LOGIN_FIELDS);

  const memberId = await authenticate(contact, password);
  if (!memberId) {
    await recordFailure([
      { key: keys[0], limit: IP_LIMIT },
      { key: keys[1], limit: LOGIN_LIMIT },
    ]);
    return failWith(form, GENERIC_LOGIN_ERROR, LOGIN_FIELDS);
  }

  await resetAttempts([keys[1]]);
  await createSession(memberId, await userAgent());

  const user = await getSessionUser();
  redirect(next ?? (await homeFor(memberId, user?.isCenterAdmin ?? false)));
}

/* --- Вход в программу по паролю программы -------------------------------- */

export async function enterProgramAction(_: FormState, form: FormData): Promise<FormState> {
  const db = getDb();
  if (!db) return failWith(form, "Вход появится после подключения базы данных", ENTER_FIELDS);

  const slug = field(form, "slug", 120);
  const programPassword = field(form, "programPassword", 200);
  if (!slug || !programPassword) return failWith(form, "Введите пароль программы", ENTER_FIELDS);

  const ip = await clientIp();
  const keys = [`enter:ip:${ip}`, `enter:program:${slug}:${ip}`];
  const blocked = await blockedFor(keys);
  if (blocked) return failWith(form, blockedMessage(blocked), ENTER_FIELDS);

  const [program] = await db
    .select({ id: schema.programs.id, hash: schema.programs.accessPasswordHash })
    .from(schema.programs)
    .where(eq(schema.programs.slug, slug));

  if (!program) return failWith(form, "Программа не найдена", ENTER_FIELDS);
  if (!program.hash) {
    return failWith(form, "Вход по паролю программы закрыт. Обратитесь к организаторам.", ENTER_FIELDS);
  }

  if (!(await verifyPassword(programPassword, program.hash))) {
    await recordFailure([
      { key: keys[0], limit: IP_LIMIT },
      { key: keys[1], limit: LOGIN_LIMIT },
    ]);
    return failWith(form, "Неверный пароль программы", ENTER_FIELDS);
  }

  const hub = `/programs/${slug}/hub`;
  // Куда вернуться: обычно в хаб, но по ссылке на опрос — сразу к опросу
  const next = safeNext(field(form, "next", 300)) ?? hub;
  const current = await getSessionUser();

  // Уже вошёл на платформу — просто добавляем в программу
  if (current) {
    await joinProgram(program.id, current.member.id, slug);
    await resetAttempts([keys[1]]);
    redirect(next);
  }

  const name = field(form, "name", 120);
  const contact = normalizeContact(field(form, "contact"));
  const password = field(form, "password", 200);

  if (name.length < 2) return failWith(form, "Укажите имя и фамилию", ENTER_FIELDS);
  if (!contact) return failWith(form, "Укажите почту или телефон — это будет ваш логин", ENTER_FIELDS);
  const weak = passwordProblem(password);
  if (weak) return failWith(form, weak, ENTER_FIELDS);
  if (password !== field(form, "passwordRepeat", 200)) return failWith(form, "Пароли не совпадают", ENTER_FIELDS);

  // Пароль программы знают все участники, поэтому через него нельзя войти
  // в уже существующую запись — даже если у неё ещё нет личного пароля.
  // Иначе любой участник мог бы занять место человека, которого завёл администратор.
  const [existing] = await db
    .select({ id: schema.members.id, passwordHash: schema.members.passwordHash })
    .from(schema.members)
    .where(eq(schema.members.contact, contact));

  if (existing) {
    return failWith(
      form,
      existing.passwordHash
        ? "Этот логин уже зарегистрирован. Войдите со своим паролем во вкладке «Я уже участник»."
        : "Этот логин уже заведён организаторами. Попросите у них личный пароль.",
      ENTER_FIELDS,
    );
  }

  const memberId = `m-${randomUUID()}`;
  try {
    await db.insert(schema.members).values({
      id: memberId,
      name,
      role: "participant",
      contact,
      passwordHash: await hashPassword(password),
      position: field(form, "position", 160) || null,
      org: field(form, "org", 200) || null,
      city: field(form, "city", 80) || null,
    });
  } catch {
    // Одновременная регистрация с тем же логином
    return failWith(form, "Этот логин уже зарегистрирован. Войдите со своим паролем.", ENTER_FIELDS);
  }

  await joinProgram(program.id, memberId, slug);
  await resetAttempts([keys[1]]);
  await createSession(memberId, await userAgent());
  redirect(next);
}

async function joinProgram(programId: number, memberId: string, slug: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  await db
    .insert(schema.programMembers)
    .values({ programId, memberId, role: "participant" })
    .onConflictDoNothing();
  await joinGeneralChats(programId, memberId, slug);
  publish({ type: "program", programSlug: slug });
}

/* --- Выход --------------------------------------------------------------- */

export async function logoutAction(): Promise<void> {
  await destroySession();
  redirect("/");
}

/* --- Личный кабинет ------------------------------------------------------ */

const PROFILE_FIELDS = ["name", "contact", "position", "org", "city"];

/** Профиль: имя, логин, должность, организация, город. */
export async function updateProfileAction(_: FormState, form: FormData): Promise<FormState> {
  const db = getDb();
  const user = await getSessionUser();
  if (!db || !user) return { error: "Нужно войти" };

  const name = field(form, "name", 120);
  const contact = normalizeContact(field(form, "contact"));
  if (name.length < 2) return failWith(form, "Укажите имя и фамилию", PROFILE_FIELDS);
  if (!contact) return failWith(form, "Укажите почту или телефон — это ваш логин", PROFILE_FIELDS);

  const [row] = await db
    .select({ contact: schema.members.contact })
    .from(schema.members)
    .where(eq(schema.members.id, user.member.id));
  if (!row) return { error: "Аккаунт не найден" };

  if (contact !== row.contact) {
    const [taken] = await db
      .select({ id: schema.members.id })
      .from(schema.members)
      .where(eq(schema.members.contact, contact));
    if (taken) return failWith(form, "Этот логин уже занят", PROFILE_FIELDS);
  }

  await db
    .update(schema.members)
    .set({
      name,
      contact,
      position: field(form, "position", 160) || null,
      org: field(form, "org", 200) || null,
      city: field(form, "city", 80) || null,
    })
    .where(eq(schema.members.id, user.member.id));

  revalidatePath("/cabinet");
  return { ok: "Профиль сохранён" };
}

/** Смена пароля: старый проверяем, остальные сессии закрываем. */
export async function changePasswordAction(_: FormState, form: FormData): Promise<FormState> {
  const db = getDb();
  const user = await getSessionUser();
  if (!db || !user) return { error: "Нужно войти" };

  const current = field(form, "current", 200);
  const next = field(form, "password", 200);
  const [row] = await db
    .select({ passwordHash: schema.members.passwordHash })
    .from(schema.members)
    .where(eq(schema.members.id, user.member.id));
  if (!row) return { error: "Аккаунт не найден" };

  if (!(await verifyPassword(current, row.passwordHash))) {
    return { error: "Текущий пароль неверный" };
  }
  const weak = passwordProblem(next);
  if (weak) return { error: weak };
  if (next !== field(form, "passwordRepeat", 200)) return { error: "Пароли не совпадают" };

  await db
    .update(schema.members)
    .set({ passwordHash: await hashPassword(next) })
    .where(eq(schema.members.id, user.member.id));

  // Пароль сменился — старые входы закрываем, текущий браузер оставляем
  await destroyMemberSessions(user.member.id);
  await createSession(user.member.id, await userAgent());
  return { ok: "Пароль обновлён" };
}

/**
 * Удаление аккаунта. Сначала убираем записи, которые ссылаются на человека
 * (посты, комментарии, сообщения, созданные беседы), затем саму запись —
 * остальное удалится каскадом.
 */
export async function deleteAccountAction(): Promise<void> {
  const db = getDb();
  const user = await getSessionUser();
  if (!db || !user) redirect("/");
  if (user.isCenterAdmin) redirect("/cabinet?error=admin");

  const id = user.member.id;
  await db.transaction(async (tx) => {
    await tx.delete(schema.messages).where(eq(schema.messages.authorId, id));
    await tx.delete(schema.comments).where(eq(schema.comments.authorId, id));
    await tx.delete(schema.posts).where(eq(schema.posts.authorId, id));
    await tx.delete(schema.conversations).where(eq(schema.conversations.createdBy, id));
    await tx.delete(schema.members).where(eq(schema.members.id, id));
  });

  await destroySession();
  redirect("/");
}
