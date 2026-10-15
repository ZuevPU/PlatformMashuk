import { uuid } from "./uid";
import type {
  AnswerValue,
  Member,
  Poll,
  PollResponse,
  PollSession,
  Question,
} from "./types";

/* ==========================================================================
   Операции над сессией опроса
   ========================================================================== */

export function createSession(poll: Poll, code?: string): PollSession {
  return {
    id: `session-${poll.id}-${Date.now()}`,
    pollId: poll.id,
    programSlug: poll.programSlug,
    code: code ?? makeCode(),
    status: "draft",
    currentIndex: 0,
    accepting: false,
    showResults: false,
    responses: [],
  };
}

/** Четырёхзначный код для входа участников. */
export function makeCode(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function startSession(session: PollSession, now: string): PollSession {
  return {
    ...session,
    status: "live",
    currentIndex: 0,
    accepting: true,
    // Результаты показываем сразу — ведущий скрывает их при необходимости
    showResults: true,
    startedAt: session.startedAt ?? now,
  };
}

export function nextQuestion(session: PollSession, poll: Poll): PollSession {
  const lastIndex = poll.questions.length - 1;
  if (session.currentIndex >= lastIndex) {
    return { ...session, accepting: false, showResults: true };
  }
  return {
    ...session,
    currentIndex: session.currentIndex + 1,
    accepting: true,
    showResults: true,
  };
}

export function previousQuestion(session: PollSession): PollSession {
  if (session.currentIndex === 0) return session;
  return { ...session, currentIndex: session.currentIndex - 1, showResults: true };
}

export function setAccepting(session: PollSession, accepting: boolean): PollSession {
  return { ...session, accepting };
}

export function setShowResults(session: PollSession, showResults: boolean): PollSession {
  return { ...session, showResults };
}

export function finishSession(session: PollSession, now: string): PollSession {
  return { ...session, status: "finished", accepting: false, showResults: true, finishedAt: now };
}

export function addResponse(session: PollSession, response: PollResponse): PollSession {
  return { ...session, responses: [...session.responses, response] };
}

export function addResponses(session: PollSession, responses: PollResponse[]): PollSession {
  return { ...session, responses: [...session.responses, ...responses] };
}

export function activeQuestion(session: PollSession, poll: Poll): Question | undefined {
  return poll.questions[session.currentIndex];
}

export function responsesFor(session: PollSession, questionId: string): PollResponse[] {
  return session.responses.filter((response) => response.questionId === questionId);
}

export function hasAnswered(
  session: PollSession,
  questionId: string,
  memberId: string,
): boolean {
  return session.responses.some(
    (response) =>
      response.questionId === questionId && (response.mine || response.memberId === memberId),
  );
}

export function createResponse(input: {
  questionId: string;
  memberId?: string;
  value: AnswerValue;
  createdAt: string;
}): PollResponse {
  return {
    id: `response-${uuid()}`,
    questionId: input.questionId,
    memberId: input.memberId,
    mine: true,
    value: input.value,
    createdAt: input.createdAt,
  };
}

/* ==========================================================================
   Подсчёт результатов
   ========================================================================== */

export interface OptionTally {
  optionId: string;
  text: string;
  correct: boolean;
  count: number;
  percent: number;
}

export function tallyOptions(question: Question, responses: PollResponse[]): OptionTally[] {
  const counts = new Map<string, number>();
  for (const response of responses) {
    for (const optionId of response.value.optionIds) {
      counts.set(optionId, (counts.get(optionId) ?? 0) + 1);
    }
  }

  const total = responses.length || 1;
  return question.options.map((option) => {
    const count = counts.get(option.id) ?? 0;
    return {
      optionId: option.id,
      text: option.text,
      correct: Boolean(option.correct),
      count,
      percent: Math.round((count / total) * 100),
    };
  });
}

export interface CloudWord {
  text: string;
  count: number;
  /** Относительный вес 1–5 — задаёт размер слова */
  weight: number;
}

export function cloudWords(responses: PollResponse[]): CloudWord[] {
  const counts = new Map<string, number>();

  for (const response of responses) {
    const raw = (response.value.text ?? "").trim();
    if (!raw) continue;
    for (const word of splitWords(raw)) {
      const key = word.toLowerCase();
      counts.set(key, (counts.get(key) ?? 0) + 1);
    }
  }

  const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]).slice(0, 60);
  if (sorted.length === 0) return [];

  const max = sorted[0][1];
  const min = sorted[sorted.length - 1][1];
  return sorted.map(([text, count]) => ({
    text,
    count,
    weight: max === min ? 3 : 1 + Math.round(((count - min) / (max - min)) * 4),
  }));
}

const STOP_WORDS = new Set([
  "и",
  "в",
  "во",
  "не",
  "что",
  "на",
  "я",
  "с",
  "со",
  "как",
  "а",
  "то",
  "все",
  "она",
  "так",
  "его",
  "но",
  "да",
  "ты",
  "к",
  "у",
  "же",
  "вы",
  "за",
  "бы",
  "по",
  "только",
  "ее",
  "мне",
  "было",
  "вот",
  "от",
  "меня",
  "еще",
  "нет",
  "о",
  "из",
  "ему",
  "теперь",
  "когда",
  "даже",
  "ну",
  "вдруг",
  "ли",
  "если",
  "уже",
  "или",
  "ни",
  "быть",
  "был",
  "него",
  "до",
  "вас",
  "нибудь",
  "опять",
  "уж",
  "вам",
  "ведь",
  "там",
  "потом",
  "себя",
  "ничего",
  "ей",
  "может",
  "они",
  "тут",
  "где",
  "есть",
  "надо",
  "ней",
  "для",
  "мы",
  "тебя",
  "их",
  "чем",
  "была",
  "сам",
  "чтоб",
  "без",
  "будто",
  "чего",
  "раз",
  "тоже",
  "себе",
  "под",
  "будет",
  "ж",
  "тогда",
  "кто",
  "этот",
  "того",
  "потому",
  "этого",
  "какой",
  "совсем",
  "ним",
  "здесь",
  "этом",
  "один",
  "почти",
  "мой",
  "тем",
  "чтобы",
  "нее",
  "сейчас",
  "были",
  "куда",
  "зачем",
  "всех",
  "никогда",
  "можно",
  "при",
  "наконец",
  "два",
  "об",
  "другой",
  "хоть",
  "после",
  "над",
  "больше",
  "тот",
  "через",
  "эти",
  "нас",
  "про",
  "всего",
  "них",
  "какая",
  "много",
  "разве",
  "три",
  "эту",
  "моя",
  "впрочем",
  "хорошо",
  "свою",
  "этой",
  "перед",
  "иногда",
  "лучше",
  "чуть",
  "том",
  "нельзя",
  "такой",
  "им",
  "более",
  "всегда",
  "конечно",
  "всю",
  "между",
]);

function splitWords(text: string): string[] {
  return text
    .toLowerCase()
    .replace(/[^\p{L}\p{N}\s-]/gu, " ")
    .split(/\s+/)
    .map((word) => word.replace(/^-+|-+$/g, ""))
    .filter((word) => word.length > 2 && !STOP_WORDS.has(word));
}

export interface ScaleStats {
  counts: number[];
  total: number;
  average: number;
}

export function scaleStats(responses: PollResponse[]): ScaleStats {
  const counts = [0, 0, 0, 0, 0];
  for (const response of responses) {
    const value = response.value.scale ?? 0;
    if (value >= 1 && value <= 5) counts[value - 1] += 1;
  }
  const total = counts.reduce((sum, count) => sum + count, 0);
  const sum = counts.reduce((acc, count, index) => acc + count * (index + 1), 0);
  return {
    counts,
    total,
    average: total === 0 ? 0 : Math.round((sum / total) * 10) / 10,
  };
}

export interface RankRow {
  optionId: string;
  text: string;
  /** Средняя позиция (1 — лучшее место) */
  avg: number;
  count: number;
}

/** Средний ранг каждого варианта: чем меньше — тем выше в зачёте. */
export function rankStats(question: Question, responses: PollResponse[]): RankRow[] {
  const positions = new Map<string, { sum: number; count: number }>();
  for (const response of responses) {
    response.value.optionIds.forEach((optionId, index) => {
      const current = positions.get(optionId) ?? { sum: 0, count: 0 };
      current.sum += index + 1;
      current.count += 1;
      positions.set(optionId, current);
    });
  }

  return question.options
    .map((option) => {
      const stat = positions.get(option.id);
      return {
        optionId: option.id,
        text: option.text,
        avg: stat ? Math.round((stat.sum / stat.count) * 10) / 10 : 0,
        count: stat?.count ?? 0,
      };
    })
    .sort((a, b) => (a.avg || 99) - (b.avg || 99));
}

export interface OpenAnswer {
  id: string;
  text: string;
  authorName?: string;
  createdAt: string;
}

export function openAnswers(
  responses: PollResponse[],
  members: Member[],
): OpenAnswer[] {
  return responses
    .map((response) => ({
      id: response.id,
      text: (response.value.text ?? "").trim(),
      authorName: response.memberId
        ? members.find((member) => member.id === response.memberId)?.name
        : undefined,
      createdAt: response.createdAt,
    }))
    .filter((answer) => answer.text.length > 0)
    .sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}

export interface LeaderboardRow {
  memberId: string;
  name: string;
  points: number;
  correct: number;
  totalQuiz: number;
  firstCorrectAt: string;
}

export function leaderboard(
  poll: Poll,
  session: PollSession,
  members: Member[],
): LeaderboardRow[] {
  const quizQuestions = poll.questions.filter((question) => question.kind === "quiz");
  const rows = new Map<string, LeaderboardRow>();

  for (const question of quizQuestions) {
    const correctIds = new Set(
      question.options.filter((option) => option.correct).map((option) => option.id),
    );

    for (const response of responsesFor(session, question.id)) {
      if (!response.memberId) continue;
      const row =
        rows.get(response.memberId) ??
        ({
          memberId: response.memberId,
          name: members.find((member) => member.id === response.memberId)?.name ?? "Участник",
          points: 0,
          correct: 0,
          totalQuiz: quizQuestions.length,
          firstCorrectAt: "",
        } satisfies LeaderboardRow);

      const isCorrect =
        response.value.optionIds.length > 0 &&
        response.value.optionIds.every((optionId) => correctIds.has(optionId));

      if (isCorrect) {
        row.points += question.points;
        row.correct += 1;
        if (!row.firstCorrectAt || response.createdAt < row.firstCorrectAt) {
          row.firstCorrectAt = response.createdAt;
        }
      }

      rows.set(row.memberId, row);
    }
  }

  return [...rows.values()].sort(
    (a, b) => b.points - a.points || a.firstCorrectAt.localeCompare(b.firstCorrectAt),
  );
}

export interface TeamRow {
  team: number;
  name: string;
  points: number;
  correct: number;
  players: number;
}

/** Стабильно раскладывает участника по командам — по id, без хранения. */
export function teamIndex(memberId: string, teams: number): number {
  let hash = 0;
  for (let index = 0; index < memberId.length; index += 1) {
    hash = (hash * 31 + memberId.charCodeAt(index)) >>> 0;
  }
  return hash % teams;
}

/** Командный зачёт: очки участников складываются в общий счёт команды. */
export function teamLeaderboard(
  poll: Poll,
  session: PollSession,
  members: Member[],
): TeamRow[] {
  const teams = Math.max(2, Math.min(6, poll.teamCount || 0));
  const rows = new Map<number, TeamRow>();
  for (let team = 0; team < teams; team += 1) {
    rows.set(team, { team, name: `Команда ${team + 1}`, points: 0, correct: 0, players: 0 });
  }

  for (const member of members) {
    if (member.role !== "participant") continue;
    const team = teamIndex(member.id, teams);
    rows.get(team)!.players += 1;
  }

  for (const row of leaderboard(poll, session, members)) {
    const team = rows.get(teamIndex(row.memberId, teams));
    if (!team) continue;
    team.points += row.points;
    team.correct += row.correct;
  }

  return [...rows.values()].sort((a, b) => b.points - a.points || a.team - b.team);
}

/* ==========================================================================
   Демонстрационные ответы для seed
   ========================================================================== */

/**
 * Сборка ответов с внешним источником случайности.
 * Демонстрационные данные используют детерминированный генератор,
 * поэтому сервер и браузер рисуют одинаковый результат.
 */
export function buildResponses(input: {
  question: Question;
  members: Member[];
  count: number;
  phrases: string[];
  createdAt: string;
  anonymous: boolean;
  random: () => number;
  exclude?: string[];
}): PollResponse[] {
  const { question, members, count, phrases, createdAt, anonymous, random, exclude = [] } = input;
  const pool = members.filter(
    (member) => member.role === "participant" && !exclude.includes(member.id),
  );
  if (pool.length === 0) return [];

  // Перемешиваем состав и берём нужное число участников: каждый отвечает один раз,
  // поэтому ответов ровно столько, сколько запрошено (в пределах состава).
  const shuffled = [...pool];
  for (let index = shuffled.length - 1; index > 0; index -= 1) {
    const swapWith = Math.floor(random() * (index + 1));
    [shuffled[index], shuffled[swapWith]] = [shuffled[swapWith], shuffled[index]];
  }

  return shuffled.slice(0, Math.min(count, shuffled.length)).map((member, index) => ({
    id: `sim-${question.id}-${index}`,
    questionId: question.id,
    memberId: anonymous ? undefined : member.id,
    value: randomAnswer(question, phrases, random),
    createdAt,
  }));
}

function randomAnswer(
  question: Question,
  phrases: string[],
  random: () => number,
): AnswerValue {
  const options = question.options;
  switch (question.kind) {
    case "single":
    case "quiz": {
      // Квиз имитируем правдоподобно: примерно две трети отвечают верно
      if (question.kind === "quiz") {
        const correct = options.filter((option) => option.correct);
        const wrong = options.filter((option) => !option.correct);
        const pick =
          random() < 0.66 || wrong.length === 0
            ? correct[Math.floor(random() * correct.length)]
            : wrong[Math.floor(random() * wrong.length)];
        return { optionIds: pick ? [pick.id] : [] };
      }
      const pick = options[Math.floor(random() * options.length)];
      return { optionIds: pick ? [pick.id] : [] };
    }
    case "multiple": {
      const picked = options.filter(() => random() < 0.45);
      const finalPicked = picked.length > 0 ? picked : options.slice(0, 1);
      return { optionIds: finalPicked.map((option) => option.id) };
    }
    case "scale": {
      const roll = random();
      const scale = roll < 0.12 ? 3 : roll < 0.5 ? 4 : 5;
      return { optionIds: [], scale };
    }
    case "open":
    default: {
      // Открытые ответы собираем из фраз: получается осмысленное облако слов
      const parts = random() < 0.25 ? 2 : 1;
      const picked: string[] = [];
      for (let index = 0; index < parts; index += 1) {
        picked.push(phrases[Math.floor(random() * phrases.length)]);
      }
      return { optionIds: [], text: picked.filter(Boolean).join(", ") };
    }
  }
}
