import { PROGRAMS } from "./mock/programs";
import { programSeason, programStatus, parseDate } from "./dates";
import { hasDatabase } from "./db/client";
import { loadProgram, loadPrograms } from "./db/queries";
import type { DirectionKey, Program, ProgramStatus, ProgramView, SeasonKey } from "./types";

export type { ProgramView };

/**
 * Слой доступа к данным программ.
 *
 * Если задана переменная DATABASE_URL, данные читаются из PostgreSQL.
 * Если базы нет — используется демонстрационный набор из `mock/programs`.
 * Интерфейс страниц в обоих случаях одинаковый.
 */

function toView(program: Program): ProgramView {
  return {
    ...program,
    season: programSeason(program),
    status: programStatus(program),
  };
}

function mockPrograms(): ProgramView[] {
  return PROGRAMS.map(toView).sort(
    (a, b) => parseDate(b.startDate).getTime() - parseDate(a.startDate).getTime(),
  );
}

export async function getAllPrograms(): Promise<ProgramView[]> {
  if (hasDatabase()) {
    const rows = await loadPrograms();
    if (rows.length > 0) return rows;
  }
  return mockPrograms();
}

export async function getProgram(slug: string): Promise<ProgramView | undefined> {
  if (hasDatabase()) {
    const row = await loadProgram(slug);
    if (row) return row;
  }
  const found = PROGRAMS.find((program) => program.slug === slug);
  return found ? toView(found) : undefined;
}

export interface ProgramFilters {
  status?: ProgramStatus | "all";
  direction?: DirectionKey | "all";
  season?: SeasonKey | "all";
  query?: string;
}

export function filterPrograms(
  programs: ProgramView[],
  filters: ProgramFilters,
): ProgramView[] {
  const { status = "all", direction = "all", season = "all", query } = filters;
  const needle = query?.trim().toLowerCase();

  return programs.filter((program) => {
    if (status !== "all" && program.status !== status) return false;
    if (direction !== "all" && program.direction !== direction) return false;
    if (season !== "all" && program.season !== season) return false;
    if (needle) {
      const haystack = [
        program.title,
        program.subtitle,
        program.location,
        program.about.lead,
      ]
        .join(" ")
        .toLowerCase();
      if (!haystack.includes(needle)) return false;
    }
    return true;
  });
}

export interface ShowcaseStats {
  programs: number;
  participants: number;
  days: number;
  finished: number;
  upcoming: number;
}

export function getShowcaseStats(programs: ProgramView[]): ShowcaseStats {
  return programs.reduce<ShowcaseStats>(
    (acc, program) => {
      acc.programs += 1;
      acc.participants += program.participants ?? 0;
      acc.days += program.days.length;
      if (program.status === "finished") acc.finished += 1;
      if (program.status === "recruiting") acc.upcoming += 1;
      return acc;
    },
    { programs: 0, participants: 0, days: 0, finished: 0, upcoming: 0 },
  );
}
