"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { and, eq, isNull } from "drizzle-orm";
import { getDb, schema } from "./db/client";
import { destroyMemberSessions, normalizeContact } from "./auth";
import { getProgramStaff } from "./admin";
import type { ProgramStaff } from "./admin";
import { generatePassword, hashPassword, passwordProblem } from "./password";
import { publish } from "./events";
import { removeBuild } from "./build-storage";
import { createGeneralChat, joinGeneralChats } from "./general-chat";
import { cleanText, isId } from "./validate";
import { DIRECTIONS } from "./types";
import type { DirectionKey, MemberRole, ProgramDay, ProgramMaterial, SeasonKey } from "./types";
import { getSessionUser } from "./auth";

/**
 * Действия админки. Каждое заново проверяет права: серверное действие —
 * публичная точка входа, интерфейс админки здесь не защита.
 *
 * После изменения публикуется событие «program»: открытые хабы участников
 * подтягивают новое расписание и сборку без перезагрузки.
 */

export interface AdminState {
  error?: string;
  ok?: string;
  /** Пароль, который нужно показать один раз и передать человеку */
  secret?: { label: string; value: string };
  /** Введённое в форму — восстанавливается после ошибки (React очищает форму) */
  values?: Record<string, string>;
  /** Выданные пароли — показываются один раз списком */
  issued?: { name: string; contact: string; password: string }[];
}

/** Ошибка формы с сохранением всего введённого, кроме паролей. */
function keep(form: FormData, error: string): AdminState {
  const values: Record<string, string> = {};
  for (const [name, value] of form.entries()) {
    if (typeof value === "string" && !/password|confirm|^\$/i.test(name)) values[name] = value;
  }
  return { error, values };
}

const SEASONS: SeasonKey[] = ["spring", "summer", "autumn", "winter"];
const DATE = /^\d{4}-\d{2}-\d{2}$/;

function text(form: FormData, name: string, max = 500): string {
  const value = form.get(name);
  return typeof value === "string" ? value.trim().slice(0, max) : "";
}

function changed(staff: Pick<ProgramStaff, "programSlug">) {
  revalidatePath("/");
  revalidatePath(`/programs/${staff.programSlug}`);
  revalidatePath("/admin", "layout");
  publish({ type: "program", programSlug: staff.programSlug });
}

async function staffOrError(slug: unknown): Promise<ProgramStaff | { error: string }> {
  if (!isId(slug)) return { error: "Программа не найдена" };
  const staff = await getProgramStaff(slug);
  return staff ?? { error: "Нет прав на управление этой программой" };
}

/* --- Программа ----------------------------------------------------------- */

function readProgramFields(form: FormData): { values?: Record<string, unknown>; error?: string } {
  const title = text(form, "title", 200);
  const subtitle = text(form, "subtitle", 200);
  const startDate = text(form, "startDate", 10);
  const endDate = text(form, "endDate", 10);
  const location = text(form, "location", 200);
  const direction = text(form, "direction", 40) as DirectionKey;
  const season = text(form, "season", 20);

  if (title.length < 2) return { error: "Укажите название программы" };
  if (!subtitle) return { error: "Укажите формат: например, «Международный образовательный семинар»" };
  if (!DATE.test(startDate) || !DATE.test(endDate)) return { error: "Укажите даты начала и окончания" };
  if (endDate < startDate) return { error: "Дата окончания раньше даты начала" };
  if (!location) return { error: "Укажите место проведения" };
  if (!DIRECTIONS.some((item) => item.key === direction)) return { error: "Выберите направление" };

  const participants = Number(text(form, "participants", 6));
  const lines = (name: string) =>
    text(form, name, 4000)
      .split("\n")
      .map((line) => line.trim())
      .filter(Boolean);

  return {
    values: {
      title,
      subtitle,
      stream: text(form, "stream", 120) || null,
      startDate,
      endDate,
      location,
      direction,
      season: SEASONS.includes(season as SeasonKey) ? (season as SeasonKey) : null,
      participants: Number.isInteger(participants) && participants > 0 ? participants : null,
      format: text(form, "format", 120) || null,
      heroLead: text(form, "heroLead", 1200) || subtitle,
      aboutLead: text(form, "aboutLead", 3000) || text(form, "heroLead", 1200) || subtitle,
      // Факты в шапке: строки «значение | подпись»
      heroFacts: lines("heroFacts")
        .slice(0, 6)
        .map((line) => {
          const [value, ...label] = line.split("|");
          return { value: value.trim().slice(0, 40), label: label.join("|").trim().slice(0, 120) };
        })
        .filter((fact) => fact.value && fact.label),
      note: text(form, "note", 2000) || null,
      landingUrl: /^https:\/\//.test(text(form, "landingUrl", 500)) ? text(form, "landingUrl", 500) : null,
      landingCode: text(form, "landingCode", 40) || null,
      driveFolder: /^https:\/\//.test(text(form, "driveFolder", 500)) ? text(form, "driveFolder", 500) : null,
    },
  };
}

export async function updateProgramAction(_: AdminState, form: FormData): Promise<AdminState> {
  const staff = await staffOrError(text(form, "slug", 120));
  if ("error" in staff) return staff;
  const db = getDb();
  if (!db) return keep(form, "База данных не подключена");

  const { values, error } = readProgramFields(form);
  if (error || !values) return keep(form, error ?? "Проверьте поля формы");

  await db.update(schema.programs).set(values).where(eq(schema.programs.id, staff.programId));
  changed(staff);
  return { ok: "Сохранено" };
}

export async function createProgramAction(_: AdminState, form: FormData): Promise<AdminState> {
  const user = await getSessionUser();
  const db = getDb();
  if (!db || !user?.isCenterAdmin) return keep(form, "Создавать программы может администратор Центра");

  const slug = text(form, "slug", 80).toLowerCase();
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(slug) || slug.length < 3) {
    return keep(form, "Адрес — латиница, цифры и дефисы, например obrazovanie-na-vysote");
  }
  if (["new", "admin", "api"].includes(slug)) return keep(form, "Этот адрес занят");

  const { values, error } = readProgramFields(form);
  if (error || !values) return keep(form, error ?? "Проверьте поля формы");

  try {
    const [created] = await db
      .insert(schema.programs)
      .values({ ...(values as typeof schema.programs.$inferInsert), slug })
      .returning({ id: schema.programs.id });
    // Создатель сразу становится администратором программы
    await db
      .insert(schema.programMembers)
      .values({ programId: created.id, memberId: user.member.id, role: "admin" })
      .onConflictDoNothing();
    await createGeneralChat(created.id, user.member.id);
  } catch {
    return keep(form, "Программа с таким адресом уже есть");
  }

  revalidatePath("/");
  revalidatePath("/admin", "layout");
  redirect(`/admin/programs/${slug}`);
}

export async function deleteProgramAction(_: AdminState, form: FormData): Promise<AdminState> {
  const staff = await staffOrError(text(form, "slug", 120));
  if ("error" in staff) return staff;
  if (!staff.isCenterAdmin) return { error: "Удалять программы может администратор Центра" };
  if (text(form, "confirm", 120) !== staff.programSlug) {
    return { error: "Введите адрес программы, чтобы подтвердить удаление" };
  }
  const db = getDb();
  if (!db) return { error: "База данных не подключена" };

  await db.delete(schema.programs).where(eq(schema.programs.id, staff.programId));
  await removeBuild(staff.programId);
  revalidatePath("/");
  revalidatePath("/admin", "layout");
  redirect("/admin");
}

/* --- Расписание ---------------------------------------------------------- */

export async function saveScheduleAction(input: {
  slug: string;
  days: ProgramDay[];
}): Promise<AdminState> {
  const staff = await staffOrError(input.slug);
  if ("error" in staff) return staff;
  const db = getDb();
  if (!db) return { error: "База данных не подключена" };
  if (!Array.isArray(input.days) || input.days.length > 31) return { error: "Не больше 31 дня" };

  type CleanSlot = Omit<typeof schema.programSlots.$inferInsert, "id" | "dayId" | "position">;
  const days: { day: number; date: string; theme: string; slots: CleanSlot[] }[] = [];
  for (const [index, day] of input.days.entries()) {
    if (!day || !DATE.test(String(day.date))) return { error: `День ${index + 1}: укажите дату` };
    const slots = Array.isArray(day.slots) ? day.slots.slice(0, 40) : [];
    const cleanSlots: CleanSlot[] = [];
    for (const slot of slots) {
      const title = cleanText(slot?.title, 300);
      if (!title) continue;
      cleanSlots.push({
        time: cleanText(slot.time, 20) ?? "",
        title,
        description: cleanText(slot.description, 1500) ?? null,
        speakers: Array.isArray(slot.speakers)
          ? slot.speakers.map((name) => cleanText(name, 160)).filter((name): name is string => Boolean(name)).slice(0, 12)
          : [],
        tag: cleanText(slot.tag, 40) ?? null,
      });
    }
    days.push({
      day: index + 1,
      date: String(day.date),
      theme: cleanText(day.theme, 300) ?? `День ${index + 1}`,
      slots: cleanSlots,
    });
  }

  await db.transaction(async (tx) => {
    // Слоты удаляются каскадом вместе с днями
    await tx.delete(schema.programDays).where(eq(schema.programDays.programId, staff.programId));
    for (const day of days) {
      const [created] = await tx
        .insert(schema.programDays)
        .values({ programId: staff.programId, day: day.day, date: day.date, theme: day.theme })
        .returning({ id: schema.programDays.id });
      if (day.slots.length) {
        await tx
          .insert(schema.programSlots)
          .values(day.slots.map((slot, position) => ({ ...slot, dayId: created.id, position })));
      }
    }
  });

  changed(staff);
  return { ok: "Расписание сохранено" };
}

/* --- Материалы ----------------------------------------------------------- */

export async function saveMaterialsAction(input: {
  slug: string;
  materials: ProgramMaterial[];
}): Promise<AdminState> {
  const staff = await staffOrError(input.slug);
  if ("error" in staff) return staff;
  const db = getDb();
  if (!db) return { error: "База данных не подключена" };
  if (!Array.isArray(input.materials) || input.materials.length > 200) {
    return { error: "Слишком много материалов" };
  }

  const rows: (typeof schema.programMaterials.$inferInsert)[] = [];
  for (const [index, material] of input.materials.entries()) {
    const title = cleanText(material?.title, 300);
    if (!title) continue;
    const links = Array.isArray(material.links)
      ? material.links
          .map((link) => ({ label: cleanText(link?.label, 120) ?? "Ссылка", url: cleanText(link?.url, 1000) ?? "" }))
          .filter((link) => /^(https:\/\/|\/)/.test(link.url))
          .slice(0, 10)
      : [];
    rows.push({
      programId: staff.programId,
      code: isId(material.id) ? material.id : `m${index + 1}`,
      day: Math.max(1, Math.min(31, Math.round(Number(material.day) || 1))),
      kind: cleanText(material.kind, 40) ?? "Материал",
      title,
      description: cleanText(material.description, 1500) ?? null,
      speakers: Array.isArray(material.speakers)
        ? material.speakers.map((name) => cleanText(name, 160)).filter((name): name is string => Boolean(name)).slice(0, 12)
        : [],
      links,
    });
  }

  await db.transaction(async (tx) => {
    await tx.delete(schema.programMaterials).where(eq(schema.programMaterials.programId, staff.programId));
    if (rows.length) await tx.insert(schema.programMaterials).values(rows);
  });

  changed(staff);
  return { ok: "Материалы сохранены" };
}

/* --- Пароль программы ---------------------------------------------------- */

export async function setProgramPasswordAction(_: AdminState, form: FormData): Promise<AdminState> {
  const staff = await staffOrError(text(form, "slug", 120));
  if ("error" in staff) return staff;
  const db = getDb();
  if (!db) return { error: "База данных не подключена" };

  const mode = text(form, "mode", 20);
  if (mode === "disable") {
    await db
      .update(schema.programs)
      .set({ accessPasswordHash: null })
      .where(eq(schema.programs.id, staff.programId));
    revalidatePath("/admin", "layout");
    return { ok: "Вход по паролю программы закрыт. Участники с личным паролем входят как раньше." };
  }

  const custom = text(form, "password", 200);
  const password = mode === "custom" ? custom : generatePassword();
  if (mode === "custom") {
    const weak = passwordProblem(password);
    if (weak) return { error: weak };
  }

  await db
    .update(schema.programs)
    .set({ accessPasswordHash: await hashPassword(password) })
    .where(eq(schema.programs.id, staff.programId));

  revalidatePath("/admin", "layout");
  return {
    ok: "Новый пароль программы действует. Старый больше не подходит.",
    secret: { label: "Пароль программы", value: password },
  };
}

/* --- Участники ----------------------------------------------------------- */

const ROLES: MemberRole[] = ["participant", "moderator", "admin"];

export async function addMemberAction(_: AdminState, form: FormData): Promise<AdminState> {
  const staff = await staffOrError(text(form, "slug", 120));
  if ("error" in staff) return staff;
  const db = getDb();
  if (!db) return keep(form, "База данных не подключена");

  const name = text(form, "name", 120);
  const contact = normalizeContact(text(form, "contact", 200));
  const role = (ROLES.includes(text(form, "role", 20) as MemberRole) ? text(form, "role", 20) : "participant") as MemberRole;

  if (name.length < 2) return keep(form, "Укажите имя и фамилию");
  if (!contact) return keep(form, "Укажите почту или телефон — это логин участника");
  if (role !== "participant" && !staff.isCenterAdmin) {
    return keep(form, "Назначать команду программы может администратор Центра");
  }

  const [existing] = await db
    .select({ id: schema.members.id, passwordHash: schema.members.passwordHash, name: schema.members.name })
    .from(schema.members)
    .where(eq(schema.members.contact, contact));

  let memberId = existing?.id;
  let password: string | null = null;

  if (!existing) {
    memberId = `m-${randomUUID()}`;
    password = generatePassword();
    await db.insert(schema.members).values({
      id: memberId,
      name,
      role: "participant",
      contact,
      passwordHash: await hashPassword(password),
      position: text(form, "position", 160) || null,
      org: text(form, "org", 200) || null,
      city: text(form, "city", 80) || null,
    });
  } else if (!existing.passwordHash) {
    password = generatePassword();
    await db
      .update(schema.members)
      .set({ passwordHash: await hashPassword(password) })
      .where(eq(schema.members.id, existing.id));
  }

  await db
    .insert(schema.programMembers)
    .values({ programId: staff.programId, memberId: memberId!, role })
    .onConflictDoUpdate({
      target: [schema.programMembers.programId, schema.programMembers.memberId],
      set: { role },
    });
  await joinGeneralChats(staff.programId, memberId!, staff.programSlug);

  changed(staff);

  if (!password) {
    return { ok: `${existing!.name} уже есть на платформе — теперь и в этой программе. Входит со своим паролем.` };
  }
  return {
    ok: `Готово: ${name} в программе. Передайте логин и пароль — пароль больше не покажется.`,
    secret: { label: `Логин: ${contact} · пароль`, value: password },
  };
}

async function targetMember(staff: ProgramStaff, memberId: unknown) {
  const db = getDb();
  if (!db || !isId(memberId)) return null;
  const [row] = await db
    .select({
      id: schema.members.id,
      name: schema.members.name,
      globalRole: schema.members.role,
      role: schema.programMembers.role,
    })
    .from(schema.programMembers)
    .innerJoin(schema.members, eq(schema.members.id, schema.programMembers.memberId))
    .where(
      and(eq(schema.programMembers.programId, staff.programId), eq(schema.programMembers.memberId, memberId)),
    );
  return row ?? null;
}

/** Модератор не управляет командой: только администратор Центра трогает модераторов и админов. */
function canManage(staff: ProgramStaff, target: { role: MemberRole; globalRole: MemberRole }): boolean {
  if (target.globalRole === "admin") return staff.isCenterAdmin;
  return staff.isCenterAdmin || target.role === "participant";
}

export async function resetMemberPasswordAction(input: {
  slug: string;
  memberId: string;
}): Promise<AdminState> {
  const staff = await staffOrError(input.slug);
  if ("error" in staff) return staff;
  const target = await targetMember(staff, input.memberId);
  if (!target) return { error: "Участник не найден" };
  if (!canManage(staff, target)) return { error: "Пароль команды меняет администратор Центра" };

  const password = generatePassword();
  const db = getDb()!;
  await db
    .update(schema.members)
    .set({ passwordHash: await hashPassword(password) })
    .where(eq(schema.members.id, target.id));
  // Старый пароль и все открытые входы перестают работать
  await destroyMemberSessions(target.id);

  revalidatePath("/admin", "layout");
  return {
    ok: `Новый пароль для ${target.name}. Старый больше не действует.`,
    secret: { label: `Пароль — ${target.name}`, value: password },
  };
}

/**
 * Пароли всем участникам программы, у кого их нет (например, перенесённым
 * из старой базы со входом по приглашениям). Без пароля человек войти не может:
 * пароль программы к существующей записи доступа не даёт.
 */
export async function issueMissingPasswordsAction(input: { slug: string }): Promise<AdminState> {
  const staff = await staffOrError(input.slug);
  if ("error" in staff) return staff;
  const db = getDb();
  if (!db) return { error: "База данных не подключена" };

  const rows = await db
    .select({
      id: schema.members.id,
      name: schema.members.name,
      contact: schema.members.contact,
      globalRole: schema.members.role,
      role: schema.programMembers.role,
    })
    .from(schema.programMembers)
    .innerJoin(schema.members, eq(schema.members.id, schema.programMembers.memberId))
    .where(and(eq(schema.programMembers.programId, staff.programId), isNull(schema.members.passwordHash)));

  const targets = rows.filter((row) => row.contact && canManage(staff, row));
  if (targets.length === 0) return { ok: "У всех, кем вы управляете, пароль уже есть" };

  const issued: NonNullable<AdminState["issued"]> = [];
  for (const target of targets) {
    const password = generatePassword();
    await db
      .update(schema.members)
      .set({ passwordHash: await hashPassword(password) })
      // Условие повторяет выборку: пароль, выданный параллельно, не перезаписываем
      .where(and(eq(schema.members.id, target.id), isNull(schema.members.passwordHash)));
    issued.push({ name: target.name, contact: target.contact!, password });
  }

  revalidatePath("/admin", "layout");
  const skipped = rows.length - targets.length;
  return {
    ok: `Пароли выданы: ${issued.length}. Скачайте список и передайте каждому его пароль — повторно он не покажется.${
      skipped ? ` Без логина или вне ваших прав: ${skipped}.` : ""
    }`,
    issued,
  };
}

export async function changeMemberRoleAction(input: {
  slug: string;
  memberId: string;
  role: MemberRole;
}): Promise<AdminState> {
  const staff = await staffOrError(input.slug);
  if ("error" in staff) return staff;
  if (!staff.isCenterAdmin) return { error: "Роли назначает администратор Центра" };
  if (!ROLES.includes(input.role)) return { error: "Неизвестная роль" };
  const target = await targetMember(staff, input.memberId);
  if (!target) return { error: "Участник не найден" };

  await getDb()!
    .update(schema.programMembers)
    .set({ role: input.role })
    .where(
      and(eq(schema.programMembers.programId, staff.programId), eq(schema.programMembers.memberId, target.id)),
    );

  changed(staff);
  return { ok: "Роль изменена" };
}

export async function removeMemberAction(input: { slug: string; memberId: string }): Promise<AdminState> {
  const staff = await staffOrError(input.slug);
  if ("error" in staff) return staff;
  if (input.memberId === staff.user.member.id) return { error: "Нельзя убрать из программы себя" };
  const target = await targetMember(staff, input.memberId);
  if (!target) return { error: "Участник не найден" };
  if (!canManage(staff, target)) return { error: "Команду программы убирает администратор Центра" };

  await getDb()!
    .delete(schema.programMembers)
    .where(
      and(eq(schema.programMembers.programId, staff.programId), eq(schema.programMembers.memberId, target.id)),
    );

  changed(staff);
  return { ok: `${target.name} больше не участник программы` };
}
