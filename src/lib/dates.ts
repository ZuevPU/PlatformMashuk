import type { Program, ProgramStatus, SeasonKey } from "./types";

const MONTHS_GENITIVE = [
  "января",
  "февраля",
  "марта",
  "апреля",
  "мая",
  "июня",
  "июля",
  "августа",
  "сентября",
  "октября",
  "ноября",
  "декабря",
];

/** Разбирает ISO-дату как календарную (без сдвигов часовых поясов). */
export function parseDate(iso: string): Date {
  const [y, m, d] = iso.slice(0, 10).split("-").map(Number);
  return new Date(Date.UTC(y, (m ?? 1) - 1, d ?? 1));
}

function dayMonth(iso: string): string {
  const date = parseDate(iso);
  return `${date.getUTCDate()} ${MONTHS_GENITIVE[date.getUTCMonth()]}`;
}

/** «29 сентября — 2 октября 2026» */
export function formatDateRange(startIso: string, endIso: string): string {
  const start = parseDate(startIso);
  const end = parseDate(endIso);
  const sameYear = start.getUTCFullYear() === end.getUTCFullYear();
  const sameMonth = sameYear && start.getUTCMonth() === end.getUTCMonth();

  if (sameMonth && start.getUTCDate() === end.getUTCDate()) {
    return `${dayMonth(startIso)} ${end.getUTCFullYear()}`;
  }
  if (sameMonth) {
    return `${start.getUTCDate()}–${end.getUTCDate()} ${MONTHS_GENITIVE[end.getUTCMonth()]} ${end.getUTCFullYear()}`;
  }
  if (sameYear) {
    return `${dayMonth(startIso)} — ${dayMonth(endIso)} ${end.getUTCFullYear()}`;
  }
  return `${dayMonth(startIso)} ${start.getUTCFullYear()} — ${dayMonth(endIso)} ${end.getUTCFullYear()}`;
}

/** «29 сентября» */
export function formatDayMonth(iso: string): string {
  return dayMonth(iso);
}

/** Количество дней программы включительно. */
export function durationDays(startIso: string, endIso: string): number {
  const ms = parseDate(endIso).getTime() - parseDate(startIso).getTime();
  return Math.round(ms / 86_400_000) + 1;
}

/** Число с окончанием: plural(4, "день", "дня", "дней") → «4 дня» */
export function plural(count: number, one: string, few: string, many: string): string {
  const n = Math.abs(count) % 100;
  const n1 = n % 10;
  if (n > 10 && n < 20) return many;
  if (n1 > 1 && n1 < 5) return few;
  if (n1 === 1) return one;
  return many;
}

export function seasonFromDate(iso: string): SeasonKey {
  const month = parseDate(iso).getUTCMonth() + 1;
  if (month >= 3 && month <= 5) return "spring";
  if (month >= 6 && month <= 8) return "summer";
  if (month >= 9 && month <= 11) return "autumn";
  return "winter";
}

export function programSeason(program: Pick<Program, "startDate" | "season">): SeasonKey {
  return program.season ?? seasonFromDate(program.startDate);
}

export function programStatus(
  program: Pick<Program, "startDate" | "endDate">,
  now: Date = new Date(),
): ProgramStatus {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const start = parseDate(program.startDate).getTime();
  const end = parseDate(program.endDate).getTime();

  if (today < start) return "recruiting";
  if (today > end) return "finished";
  return "ongoing";
}

export const STATUS_LABELS: Record<ProgramStatus, string> = {
  recruiting: "Идёт набор",
  ongoing: "Идёт сейчас",
  finished: "Программа завершена",
};

export const STATUS_SHORT: Record<ProgramStatus, string> = {
  recruiting: "Набор",
  ongoing: "Идёт",
  finished: "Архив",
};

/** «через 12 дней» / «3 дня назад» / «сегодня» */
export function relativeToStart(program: Pick<Program, "startDate" | "endDate">, now: Date = new Date()): string {
  const today = Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate());
  const start = parseDate(program.startDate).getTime();
  const end = parseDate(program.endDate).getTime();

  if (today >= start && today <= end) return "идёт сейчас";
  const target = today < start ? start : end;
  const diff = Math.round(Math.abs(target - today) / 86_400_000);
  const word = plural(diff, "день", "дня", "дней");
  return today < start ? `старт через ${diff} ${word}` : `завершилась ${diff} ${word} назад`;
}

/* ==========================================================================
   Время сообщений
   Значения читаются из строки ISO буквально (без пересчёта часовых поясов):
   так сервер и браузер показывают одинаковое время и разметка не расходится.
   ========================================================================== */

/** «15:40» */
export function formatTime(iso: string): string {
  return iso.slice(11, 16);
}

/** «6 октября, 15:40» */
export function formatDateTimeLabel(iso: string): string {
  return `${dayMonth(iso)}, ${formatTime(iso)}`;
}

/** Текущий момент в виде строки с местным смещением: для новых сообщений. */
export function localIsoNow(now: Date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, "0");
  const offset = -now.getTimezoneOffset();
  const sign = offset >= 0 ? "+" : "-";
  const abs = Math.abs(offset);

  return [
    `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`,
    `T${pad(now.getHours())}:${pad(now.getMinutes())}:00`,
    `${sign}${pad(Math.floor(abs / 60))}:${pad(abs % 60)}`,
  ].join("");
}

/**
 * Приводит время из базы к строке с московским смещением.
 *
 * Вся платформа показывает время программ по Москве, а сервер может работать
 * в UTC — поэтому пересчитываем явно и получаем одинаковый результат везде.
 */
export function toMoscowIso(value: Date | string): string {
  const date = typeof value === "string" ? new Date(value) : value;
  const shifted = new Date(date.getTime() + 180 * 60_000);
  const pad = (input: number) => String(input).padStart(2, "0");

  return [
    `${shifted.getUTCFullYear()}-${pad(shifted.getUTCMonth() + 1)}-${pad(shifted.getUTCDate())}`,
    `T${pad(shifted.getUTCHours())}:${pad(shifted.getUTCMinutes())}:${pad(shifted.getUTCSeconds())}`,
    "+03:00",
  ].join("");
}

/** Дата в виде «ГГГГ-ММ-ДД» для полей типа date. */
export function toDateOnly(value: Date | string): string {
  return toMoscowIso(value).slice(0, 10);
}

