import { buildResponses } from "../poll-actions";
import { SIMULATED_PHRASES } from "../phrases";
import { POLL_TEMPLATES, open, scale } from "../poll-templates";
import type { Poll, PollData, PollResponse, PollSession, Question } from "../types";
import type { ProgramView } from "../data";

/**
 * Демонстрационные опросы программы «Образование на высоте» — источник для seed.
 */

/* ==========================================================================
   Демонстрационные опросы
   Генератор с фиксированным зерном: сервер и браузер считают одинаково,
   поэтому разметка не расходится при гидратации.
   ========================================================================== */

function seededRandom(seed: number): () => number {
  let state = seed % 2147483647;
  if (state <= 0) state += 2147483646;
  return () => {
    state = (state * 16807) % 2147483647;
    return (state - 1) / 2147483646;
  };
}

function poll(input: Omit<Poll, "programSlug" | "teamCount"> & { programSlug?: string; teamCount?: number }): Poll {
  return { programSlug: "", teamCount: 0, ...input };
}

function session(input: Omit<PollSession, "programSlug"> & { programSlug?: string }): PollSession {
  return { programSlug: "", ...input };
}

function deterministicResponses(options: {
  question: Question;
  seed: number;
  count: number;
  members: Parameters<typeof buildResponses>[0]["members"];
  anonymous: boolean;
  createdAt: string;
}): PollResponse[] {
  return buildResponses({
    question: options.question,
    members: options.members,
    count: options.count,
    phrases: SIMULATED_PHRASES,
    createdAt: options.createdAt,
    anonymous: options.anonymous,
    random: seededRandom(options.seed),
  });
}

const OBRAZOVANIE_REFLECTION = poll({
  id: "poll-ov-reflection",
  title: "Рефлексия четвёртого дня",
  description: "Оценка программы по шкале и два открытых вопроса по итогам четырёх дней.",
  anonymous: false,
  createdAt: "2026-10-02T10:10:00+03:00",
  source: "custom",
  questions: [
    scale("o-1", "Насколько программа оправдала ожидания?", {
      min: "не оправдала",
      max: "полностью",
    }),
    open("o-2", "Что вы забираете с собой после программы?", { visual: "cloud" }),
    open("o-3", "Что стоит изменить в программе в следующий раз?", { visual: "list" }),
  ],
});

const OBRAZOVANIE_QUIZ = poll({
  id: "poll-ov-quiz",
  title: "Квиз: вызовы будущего",
  description:
    "Четыре вопроса по содержанию первого дня. Очки за верные ответы, лидерборд на экране.",
  anonymous: false,
  createdAt: "2026-09-29T21:00:00+03:00",
  source: "template",
  templateKey: "myths-quiz",
  questions: POLL_TEMPLATES.find((template) => template.key === "myths-quiz")!.questions,
});

export function getMockPollData(
  program: ProgramView,
  members: Parameters<typeof buildResponses>[0]["members"],
): PollData {
  const templates = POLL_TEMPLATES;

  if (program.slug === "obrazovanie-na-vysote") {
    const reflectionQuestions = OBRAZOVANIE_REFLECTION.questions;
    const quizQuestions = OBRAZOVANIE_QUIZ.questions;

    const reflectionResponses: PollResponse[] = [
      ...deterministicResponses({
        question: reflectionQuestions[0],
        seed: 991,
        count: 16,
        members,
        anonymous: false,
        createdAt: "2026-10-02T10:20:00+03:00",
      }),
      ...deterministicResponses({
        question: reflectionQuestions[1],
        seed: 992,
        count: 15,
        members,
        anonymous: false,
        createdAt: "2026-10-02T10:24:00+03:00",
      }),
      ...deterministicResponses({
        question: reflectionQuestions[2],
        seed: 993,
        count: 9,
        members,
        anonymous: false,
        createdAt: "2026-10-02T10:28:00+03:00",
      }),
    ];

    const quizResponses: PollResponse[] = quizQuestions.flatMap((question, index) =>
      deterministicResponses({
        question,
        seed: 770 + index,
        count: 12,
        members,
        anonymous: false,
        createdAt: `2026-09-29T21:0${index + 1}:00+03:00`,
      }),
    );

    return {
      templates,
      polls: [OBRAZOVANIE_REFLECTION, OBRAZOVANIE_QUIZ],
      sessions: [
        session({
          id: "session-ov-reflection",
          programSlug: program.slug,
          pollId: OBRAZOVANIE_REFLECTION.id,
          code: "0210",
          status: "finished",
          currentIndex: 2,
          accepting: false,
          showResults: true,
          startedAt: "2026-10-02T10:15:00+03:00",
          finishedAt: "2026-10-02T10:40:00+03:00",
          responses: reflectionResponses,
        }),
        session({
          id: "session-ov-quiz",
          programSlug: program.slug,
          pollId: OBRAZOVANIE_QUIZ.id,
          code: "1993",
          status: "finished",
          currentIndex: 3,
          accepting: false,
          showResults: true,
          startedAt: "2026-09-29T21:00:00+03:00",
          finishedAt: "2026-09-29T21:35:00+03:00",
          responses: quizResponses,
        }),
      ],
    };
  }

  return { templates, polls: [], sessions: [] };
}
