import { cache } from "react";
import { redirect } from "next/navigation";
import { and, asc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "./db/client";
import { getSessionUser } from "./auth";
import type { SessionUser } from "./auth";
import type { MemberRole } from "./types";

/**
 * Права в админке.
 *
 * Администратор Центра видит все программы, создаёт и удаляет их,
 * назначает модераторов. Модератор управляет только своими программами:
 * расписание, материалы, сборка, пароль программы и участники.
 */

export interface AdminProgram {
  id: number;
  slug: string;
  title: string;
  subtitle: string;
  startDate: string;
  endDate: string;
  season: string | null;
  members: number;
  hasPassword: boolean;
  hasBuild: boolean;
}

export interface ProgramStaff {
  user: SessionUser;
  programId: number;
  programSlug: string;
  /** Роль в программе; у администратора Центра — admin */
  role: MemberRole;
  isCenterAdmin: boolean;
}

/** Программы, которыми человек может управлять. */
export const listManagedPrograms = cache(async (user: SessionUser): Promise<AdminProgram[]> => {
  const db = getDb();
  if (!db) return [];

  let ids: number[] | null = null;
  if (!user.isCenterAdmin) {
    const rows = await db
      .select({ programId: schema.programMembers.programId })
      .from(schema.programMembers)
      .where(
        and(
          eq(schema.programMembers.memberId, user.member.id),
          inArray(schema.programMembers.role, ["admin", "moderator"]),
        ),
      );
    ids = rows.map((row) => row.programId);
    if (ids.length === 0) return [];
  }

  const rows = await db
    .select({
      id: schema.programs.id,
      slug: schema.programs.slug,
      title: schema.programs.title,
      subtitle: schema.programs.subtitle,
      startDate: schema.programs.startDate,
      endDate: schema.programs.endDate,
      season: schema.programs.season,
      hasPassword: sql<boolean>`${schema.programs.accessPasswordHash} is not null`,
      hasBuild: sql<boolean>`${schema.programs.buildUploadedAt} is not null`,
      members: sql<number>`(select count(*)::int from program_members pm where pm.program_id = ${schema.programs.id})`,
    })
    .from(schema.programs)
    .where(ids ? inArray(schema.programs.id, ids) : undefined)
    .orderBy(asc(schema.programs.startDate));

  return rows.map((row) => ({ ...row, members: Number(row.members) }));
});

/** Вход в админку: администратор Центра или команда хотя бы одной программы. */
export async function requireAdminArea(): Promise<SessionUser> {
  const user = await getSessionUser();
  if (!user) redirect("/join?next=/admin");
  if (user.isCenterAdmin) return user;
  const programs = await listManagedPrograms(user);
  if (programs.length === 0) redirect("/");
  return user;
}

/** Право управлять конкретной программой. null — нет прав. */
export async function getProgramStaff(slug: string): Promise<ProgramStaff | null> {
  const db = getDb();
  const user = await getSessionUser();
  if (!db || !user || typeof slug !== "string") return null;

  const [program] = await db
    .select({ id: schema.programs.id, slug: schema.programs.slug })
    .from(schema.programs)
    .where(eq(schema.programs.slug, slug));
  if (!program) return null;

  if (user.isCenterAdmin) {
    return { user, programId: program.id, programSlug: program.slug, role: "admin", isCenterAdmin: true };
  }

  const [membership] = await db
    .select({ role: schema.programMembers.role })
    .from(schema.programMembers)
    .where(
      and(
        eq(schema.programMembers.programId, program.id),
        eq(schema.programMembers.memberId, user.member.id),
      ),
    );

  if (!membership || membership.role === "participant") return null;
  return {
    user,
    programId: program.id,
    programSlug: program.slug,
    role: membership.role,
    isCenterAdmin: false,
  };
}

export async function requireProgramStaff(slug: string): Promise<ProgramStaff> {
  const staff = await getProgramStaff(slug);
  if (!staff) redirect("/admin");
  return staff;
}

export interface ProgramStats {
  posts: number;
  comments: number;
  members: number;
}

/** Короткая сводка по программе для админки: посты, комментарии, состав. */
export async function getProgramStats(programId: number): Promise<ProgramStats> {
  const db = getDb();
  if (!db) return { posts: 0, comments: 0, members: 0 };

  const [row] = await db
    .select({
      posts: sql<number>`(select count(*)::int from posts where program_id = ${programId})`,
      comments: sql<number>`(select count(*)::int from comments c join posts p on p.id = c.post_id where p.program_id = ${programId})`,
      members: sql<number>`(select count(*)::int from program_members where program_id = ${programId})`,
    })
    .from(schema.programs)
    .where(eq(schema.programs.id, programId))
    .limit(1);

  return {
    posts: Number(row?.posts ?? 0),
    comments: Number(row?.comments ?? 0),
    members: Number(row?.members ?? 0),
  };
}

export interface AdminMember {
  id: string;
  name: string;
  contact: string | null;
  role: MemberRole;
  position: string | null;
  org: string | null;
  city: string | null;
  /** Задан личный пароль — человек может входить */
  activated: boolean;
  /** Администратор Центра: его пароль меняет только другой администратор Центра */
  centerAdmin: boolean;
}

export async function listProgramMembers(programId: number): Promise<AdminMember[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select({
      id: schema.members.id,
      name: schema.members.name,
      contact: schema.members.contact,
      role: schema.programMembers.role,
      position: schema.members.position,
      org: schema.members.org,
      city: schema.members.city,
      activated: sql<boolean>`${schema.members.passwordHash} is not null`,
      globalRole: schema.members.role,
    })
    .from(schema.programMembers)
    .innerJoin(schema.members, eq(schema.members.id, schema.programMembers.memberId))
    .where(eq(schema.programMembers.programId, programId))
    .orderBy(asc(schema.members.name));

  return rows.map(({ globalRole, ...row }) => ({
    ...row,
    activated: Boolean(row.activated),
    centerAdmin: globalRole === "admin",
  }));
}
