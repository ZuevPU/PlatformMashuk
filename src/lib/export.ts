import type { Member, Poll, PollResponse, PollSession, Question } from "./types";
import { QUESTION_KIND_LABELS } from "./types";
import {
  cloudWords,
  leaderboard,
  openAnswers,
  rankStats,
  responsesFor,
  scaleStats,
  tallyOptions,
} from "./poll-actions";

/* ==========================================================================
   Выгрузка результатов
   ========================================================================== */

function csvCell(value: string | number): string {
  const text = String(value).replace(/"/g, '""');
  return `"${text}"`;
}

function csvRow(cells: (string | number)[]): string {
  return cells.map(csvCell).join(";");
}

function answerText(question: Question, response: PollResponse): string {
  if (question.kind === "scale") return `${response.value.scale ?? ""} из 5`;
  if (question.kind === "open") return response.value.text ?? "";
  return response.value.optionIds
    .map((optionId) => question.options.find((option) => option.id === optionId)?.text ?? "")
    .filter(Boolean)
    .join(", ");
}

/**
 * Таблица результатов: сводка по вопросам плюс все ответы построчно.
 * Разделитель — точка с запятой, кодировка UTF-8 с BOM: файл открывается
 * в Excel двойным щелчком без импорта.
 */
export function buildPollCsv(input: {
  poll: Poll;
  session: PollSession;
  members: Member[];
  programTitle: string;
}): string {
  const { poll, session, members, programTitle } = input;
  const rows: string[] = [];

  rows.push(csvRow(["Опрос", poll.title]));
  rows.push(csvRow(["Программа", programTitle]));
  rows.push(csvRow(["Код сессии", session.code]));
  rows.push(
    csvRow([
      "Статус",
      session.status === "live" ? "идёт" : session.status === "finished" ? "завершён" : "черновик",
    ]),
  );
  rows.push(csvRow(["Анонимный", poll.anonymous ? "да" : "нет"]));
  rows.push(csvRow(["Ответов всего", session.responses.length]));
  rows.push(csvRow(["Выгружено", new Date().toLocaleString("ru-RU")]));

  rows.push("");
  rows.push(csvRow(["Сводка по вопросам"]));
  rows.push(csvRow(["№", "Вопрос", "Тип", "Ответ", "Количество", "Доля"]));

  for (const [index, question] of poll.questions.entries()) {
    const responses = responsesFor(session, question.id);

    if (question.kind === "open" || question.kind === "cloud" || question.kind === "qa") {
      const words = question.kind === "cloud" ? cloudWords(responses).slice(0, 20) : [];
      if (words.length === 0 && question.kind !== "qa") {
        rows.push(csvRow([index + 1, question.title, QUESTION_KIND_LABELS[question.kind], "—", 0, ""]));
      }
      for (const word of words) {
        rows.push(
          csvRow([index + 1, question.title, "Открытый ответ", word.text, word.count, ""]),
        );
      }
      for (const answer of openAnswers(responses, members)) {
        rows.push(
          csvRow([
            index + 1,
            question.title,
            "Открытый ответ (текст)",
            answer.text,
            "",
            answer.authorName ?? "анонимно",
          ]),
        );
      }
      continue;
    }

    if (question.kind === "scale") {
      const stats = scaleStats(responses);
      stats.counts.forEach((count, scaleIndex) => {
        rows.push(
          csvRow([
            index + 1,
            question.title,
            "Шкала",
            `${scaleIndex + 1} из 5`,
            count,
            stats.total > 0 ? `${Math.round((count / stats.total) * 100)}%` : "0%",
          ]),
        );
      });
      rows.push(csvRow([index + 1, question.title, "Шкала", "Средний балл", stats.average, ""]));
      continue;
    }

    if (question.kind === "spinner") continue;

    if (question.kind === "rank") {
      for (const row of rankStats(question, responses)) {
        rows.push(
          csvRow([
            index + 1,
            question.title,
            "Ранжирование",
            row.text,
            row.count ? row.avg : "—",
            `ответов: ${row.count}`,
          ]),
        );
      }
      continue;
    }

    for (const tally of tallyOptions(question, responses)) {
      rows.push(
        csvRow([
          index + 1,
          question.title,
          QUESTION_KIND_LABELS[question.kind],
          tally.text,
          tally.count,
          `${tally.percent}%`,
        ]),
      );
    }
  }

  rows.push("");
  rows.push(csvRow(["Все ответы"]));
  rows.push(csvRow(["Время", "Вопрос", "Участник", "Ответ"]));

  for (const response of [...session.responses].sort((a, b) =>
    a.createdAt.localeCompare(b.createdAt),
  )) {
    const question = poll.questions.find((item) => item.id === response.questionId);
    if (!question) continue;
    rows.push(
      csvRow([
        new Date(response.createdAt).toLocaleString("ru-RU"),
        question.title,
        response.memberId
          ? (members.find((member) => member.id === response.memberId)?.name ?? "участник")
          : "анонимно",
        answerText(question, response),
      ]),
    );
  }

  return `\uFEFF${rows.join("\r\n")}`;
}

export function downloadText(filename: string, text: string, mime = "text/csv;charset=utf-8"): void {
  downloadBlob(filename, new Blob([text], { type: mime }));
}

export function downloadBlob(filename: string, blob: Blob): void {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

/* ==========================================================================
   Картинка с результатами вопроса
   ========================================================================== */

const PNG_WIDTH = 1600;
const PNG_HEIGHT = 1000;
const PAPER = "#F7F6F2";
const NAVY = "#223F9A";
const INK = "#332D24";
const MUTED = "#655D53";

function fontFamily(): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue("--font-geologica");
  const family = value.trim();
  return family ? `${family}, Verdana, sans-serif` : "Verdana, sans-serif";
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => resolve(null);
    image.src = src;
  });
}

function wrapText(
  context: CanvasRenderingContext2D,
  text: string,
  maxWidth: number,
): string[] {
  const words = text.split(/\s+/);
  const lines: string[] = [];
  let current = "";

  for (const word of words) {
    const candidate = current ? `${current} ${word}` : word;
    if (context.measureText(candidate).width <= maxWidth || current === "") {
      current = candidate;
    } else {
      lines.push(current);
      current = word;
    }
  }
  if (current) lines.push(current);
  return lines;
}

function mixAccent(accent: string, ratio: number): string {
  // Полупрозрачный акцент для полос и подложек
  const hex = accent.replace("#", "");
  const r = parseInt(hex.slice(0, 2), 16);
  const g = parseInt(hex.slice(2, 4), 16);
  const b = parseInt(hex.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${ratio})`;
}

/**
 * Рисует карточку результатов текущего вопроса: её удобно вставить
 * в отчёт или в презентацию по итогам программы.
 */
export async function exportQuestionPng(input: {
  poll: Poll;
  question: Question;
  session: PollSession;
  members: Member[];
  accent: string;
  /** Тёмный тон акцента для слов облака: светлый акцент на белом не читается */
  accentInk?: string;
  fileName: string;
}): Promise<void> {
  const { poll, question, session, members, accent, fileName } = input;
  const accentInk = input.accentInk ?? accent;
  const pollTitle = poll.title;
  const responses = responsesFor(session, question.id);

  if (document.fonts?.ready) await document.fonts.ready;

  const canvas = document.createElement("canvas");
  const scale = 2;
  canvas.width = PNG_WIDTH * scale;
  canvas.height = PNG_HEIGHT * scale;
  const context = canvas.getContext("2d");
  if (!context) return;

  context.scale(scale, scale);
  const font = fontFamily();

  // Фон и верхняя фирменная полоса
  context.fillStyle = PAPER;
  context.fillRect(0, 0, PNG_WIDTH, PNG_HEIGHT);

  const headerHeight = 190;
  const gradient = context.createLinearGradient(0, 0, PNG_WIDTH, headerHeight);
  gradient.addColorStop(0, NAVY);
  gradient.addColorStop(1, "#2E56B8");
  context.fillStyle = gradient;
  context.fillRect(0, 0, PNG_WIDTH, headerHeight);

  const glow = context.createRadialGradient(PNG_WIDTH - 180, 20, 10, PNG_WIDTH - 180, 20, 420);
  glow.addColorStop(0, mixAccent(accent, 0.55));
  glow.addColorStop(1, "rgba(0,0,0,0)");
  context.fillStyle = glow;
  context.fillRect(0, 0, PNG_WIDTH, headerHeight);

  const logo = await loadImage("/brand/logo/logo_full_white.png");
  if (logo) {
    const logoWidth = 210;
    context.drawImage(logo, 80, 56, logoWidth, (logo.height / logo.width) * logoWidth);
  }

  context.fillStyle = "rgba(255,255,255,0.78)";
  context.font = `500 20px ${font}`;
  context.textAlign = "right";
  context.fillText("Результаты опроса", PNG_WIDTH - 80, 78);
  context.font = `600 22px ${font}`;
  context.fillStyle = "#fff";
  context.fillText(pollTitle, PNG_WIDTH - 80, 112);
  context.font = `400 18px ${font}`;
  context.fillStyle = "rgba(255,255,255,0.66)";
  context.fillText(
    `Ответов: ${responses.length} · код сессии ${session.code}`,
    PNG_WIDTH - 80,
    146,
  );

  // Вопрос
  context.textAlign = "left";
  context.fillStyle = NAVY;
  context.font = `600 42px ${font}`;
  const questionLines = wrapText(context, question.title, PNG_WIDTH - 160);
  let cursorY = 285;
  for (const line of questionLines.slice(0, 2)) {
    context.fillText(line, 80, cursorY);
    cursorY += 52;
  }

  context.fillStyle = MUTED;
  context.font = `400 20px ${font}`;
  context.fillText(QUESTION_KIND_LABELS[question.kind], 80, cursorY + 8);
  cursorY += 70;

  // Тело карточки
  if (question.kind === "open") {
    const words = cloudWords(responses);
    if (words.length === 0) {
      drawEmpty(context, font, cursorY);
    } else {
      let x = 80;
      let lineHeight = 0;
      const palette = [accentInk, NAVY, "#0B4D4D", "#246A99", "#7C6440"];
      words.slice(0, 34).forEach((word, index) => {
        const size = 20 + word.weight * 9;
        context.font = `${index % 3 === 0 ? 600 : 500} ${size}px ${font}`;
        const width = context.measureText(word.text).width;
        if (x + width > PNG_WIDTH - 80) {
          x = 80;
          cursorY += lineHeight + 18;
          lineHeight = 0;
        }
        if (cursorY > PNG_HEIGHT - 190) return;
        context.fillStyle = palette[index % palette.length];
        context.fillText(word.text, x, cursorY + size);
        x += width + 28;
        lineHeight = Math.max(lineHeight, size);
      });
    }
  } else if (question.kind === "scale") {
    const stats = scaleStats(responses);
    context.fillStyle = NAVY;
    context.font = `600 96px ${font}`;
    context.fillText(stats.average.toFixed(1).replace(".", ","), 80, cursorY + 90);
    context.font = `400 20px ${font}`;
    context.fillStyle = MUTED;
    context.fillText("средний балл из 5", 80, cursorY + 124);

    const barWidth = 720;
    stats.counts.forEach((count, index) => {
      const y = cursorY + 10 + index * 62;
      const width = stats.total > 0 ? (count / stats.total) * barWidth : 0;
      context.fillStyle = "rgba(34,63,154,0.08)";
      context.fillRect(360, y, barWidth, 34);
      context.fillStyle = accent;
      context.fillRect(360, y, Math.max(width, count > 0 ? 6 : 0), 34);
      context.fillStyle = INK;
      context.font = `600 20px ${font}`;
      context.fillText(`${index + 1}`, 300, y + 26);
      context.font = `400 20px ${font}`;
      context.fillStyle = MUTED;
      context.fillText(`${count}`, 360 + barWidth + 24, y + 26);
    });
  } else if (question.kind === "quiz") {
    const rows = leaderboard(poll, session, members).slice(0, 6);
    if (rows.length === 0) {
      drawEmpty(context, font, cursorY);
    } else {
      rows.forEach((row, index) => {
        const y = cursorY + index * 66;
        context.fillStyle = index === 0 ? mixAccent(accent, 0.16) : "rgba(34,63,154,0.05)";
        context.fillRect(80, y, PNG_WIDTH - 160, 54);
        context.fillStyle = index === 0 ? NAVY : MUTED;
        context.font = `600 22px ${font}`;
        context.fillText(String(index + 1), 108, y + 35);
        context.fillStyle = INK;
        context.font = `500 24px ${font}`;
        context.fillText(row.name, 160, y + 35);
        context.fillStyle = NAVY;
        context.font = `600 24px ${font}`;
        context.textAlign = "right";
        context.fillText(`${row.points} очков`, PNG_WIDTH - 110, y + 35);
        context.textAlign = "left";
      });
    }
  } else {
    const tallies = tallyOptions(question, responses);
    const maxCount = Math.max(...tallies.map((tally) => tally.count), 1);
    const barWidth = PNG_WIDTH - 160 - 320;
    tallies.forEach((tally, index) => {
      const y = cursorY + index * 74;
      context.fillStyle = INK;
      context.font = `500 22px ${font}`;
      const labelLines = wrapText(context, tally.text, 300);
      context.fillText(labelLines[0] ?? "", 80, y + 28);
      const width = (tally.count / maxCount) * barWidth;
      context.fillStyle = "rgba(34,63,154,0.08)";
      context.fillRect(400, y, barWidth, 38);
      context.fillStyle = tally.correct ? "#0B4D4D" : accent;
      context.fillRect(400, y, Math.max(width, tally.count > 0 ? 6 : 0), 38);
      context.fillStyle = MUTED;
      context.font = `600 20px ${font}`;
      context.fillText(`${tally.count} · ${tally.percent}%`, 400 + barWidth + 20, y + 28);
    });
  }

  // Подвал
  context.fillStyle = "rgba(34,63,154,0.12)";
  context.fillRect(80, PNG_HEIGHT - 130, PNG_WIDTH - 160, 1);
  context.fillStyle = NAVY;
  context.font = `600 20px ${font}`;
  context.fillText("Знания на высоте", 80, PNG_HEIGHT - 84);
  context.fillStyle = MUTED;
  context.font = `400 18px ${font}`;
  context.fillText("АНО «Центр знаний «Машук»", 80, PNG_HEIGHT - 56);
  context.textAlign = "right";
  context.fillText(
    `Выгружено ${new Date().toLocaleDateString("ru-RU")}`,
    PNG_WIDTH - 80,
    PNG_HEIGHT - 56,
  );
  context.textAlign = "left";

  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/png"));
  if (blob) downloadBlob(fileName, blob);
}

function drawEmpty(context: CanvasRenderingContext2D, font: string, y: number) {
  context.fillStyle = MUTED;
  context.font = `400 22px ${font}`;
  context.fillText("Ответов пока нет", 80, y + 40);
}
