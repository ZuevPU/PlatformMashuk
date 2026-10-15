import type { ProgramDay } from "./types";

/**
 * Экспорт расписания программы в календарь (.ics).
 * Время трактуется как московское (UTC+3) — так же, как показывает платформа.
 */

function parseStart(dateIso: string, time: string): number {
  const [year, month, day] = dateIso.slice(0, 10).split("-").map(Number);
  const match = time.match(/(\d{1,2}):(\d{2})/);
  const hours = match ? Number(match[1]) : 10;
  const minutes = match ? Number(match[2]) : 0;
  return Date.UTC(year, (month ?? 1) - 1, day ?? 1, hours, minutes);
}

function formatStamp(ms: number): string {
  const date = new Date(ms);
  const pad = (value: number) => String(value).padStart(2, "0");
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(
    date.getUTCHours(),
  )}${pad(date.getUTCMinutes())}00`;
}

/** Экранирование текста по RFC 5545. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, "\\\\")
    .replace(/;/g, "\\;")
    .replace(/,/g, "\\,")
    .replace(/\n/g, "\\n");
}

export function buildScheduleIcs(input: {
  title: string;
  location?: string;
  days: ProgramDay[];
}): string {
  const now = formatStamp(Date.now());
  const lines: string[] = [
    "BEGIN:VCALENDAR",
    "VERSION:2.0",
    "PRODID:-//Центр знаний Машук//Платформа//RU",
    "CALSCALE:GREGORIAN",
    "METHOD:PUBLISH",
    "BEGIN:VTIMEZONE",
    "TZID:Europe/Moscow",
    "BEGIN:STANDARD",
    "DTSTART:19700101T000000",
    "TZOFFSETFROM:+0300",
    "TZOFFSETTO:+0300",
    "TZNAME:MSK",
    "END:STANDARD",
    "END:VTIMEZONE",
  ];

  for (const day of input.days) {
    for (const [index, slot] of day.slots.entries()) {
      const start = parseStart(day.date, slot.time);
      lines.push("BEGIN:VEVENT");
      lines.push(`UID:day-${day.day}-${index}@mashuk`);
      lines.push(`DTSTAMP:${now}`);
      lines.push(`DTSTART;TZID=Europe/Moscow:${formatStamp(start)}`);
      lines.push(`DTEND;TZID=Europe/Moscow:${formatStamp(start + 60 * 60 * 1000)}`);
      lines.push(`SUMMARY:${escapeText(slot.title)}`);
      const description = [slot.description, slot.speakers?.join(", ")].filter(Boolean).join(" · ");
      if (description) lines.push(`DESCRIPTION:${escapeText(description)}`);
      if (input.location) lines.push(`LOCATION:${escapeText(input.location)}`);
      lines.push("END:VEVENT");
    }
  }

  lines.push("END:VCALENDAR");
  return lines.join("\r\n");
}
