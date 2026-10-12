import { buildResponses } from "../poll-actions";
import { SIMULATED_PHRASES } from "../phrases";
import type {
  Poll,
  PollData,
  PollResponse,
  PollSession,
  PollTemplate,
  Question,
} from "../types";
import type { ProgramView } from "../data";

/* ==========================================================================
   Конструкторы вопросов
   ========================================================================== */

function open(
  id: string,
  title: string,
  options: { hint?: string; visual?: "cloud" | "list" } = {},
): Question {
  return {
    id,
    kind: "open",
    title,
    hint: options.hint,
    options: [],
    visual: options.visual ?? "cloud",
    timeLimit: 0,
    points: 0,
  };
}

function single(
  id: string,
  title: string,
  options: string[],
  extra: { hint?: string; timeLimit?: number } = {},
): Question {
  return {
    id,
    kind: "single",
    title,
    hint: extra.hint,
    options: options.map((text, index) => ({ id: `${id}-o${index + 1}`, text })),
    timeLimit: extra.timeLimit ?? 0,
    points: 0,
  };
}

function multiple(id: string, title: string, options: string[], hint?: string): Question {
  return {
    id,
    kind: "multiple",
    title,
    hint,
    options: options.map((text, index) => ({ id: `${id}-o${index + 1}`, text })),
    timeLimit: 0,
    points: 0,
  };
}

function scale(
  id: string,
  title: string,
  labels: { min: string; max: string },
  hint?: string,
): Question {
  return {
    id,
    kind: "scale",
    title,
    hint,
    options: [],
    scaleLabels: labels,
    timeLimit: 0,
    points: 0,
  };
}

function quiz(
  id: string,
  title: string,
  options: [string, boolean][],
  extra: { points?: number; timeLimit?: number; hint?: string } = {},
): Question {
  return {
    id,
    kind: "quiz",
    title,
    hint: extra.hint,
    options: options.map(([text, correct], index) => ({
      id: `${id}-o${index + 1}`,
      text,
      correct,
    })),
    timeLimit: extra.timeLimit ?? 30,
    points: extra.points ?? 10,
  };
}

/* ==========================================================================
   Библиотека шаблонов
   ========================================================================== */

export const POLL_TEMPLATES: PollTemplate[] = [
  {
    key: "intro-request",
    title: "Знакомство: профессиональный запрос",
    description:
      "Короткий открытый вопрос в начале программы. Ответы видно списком — ведущий может опереться на них в первом блоке.",
    purpose: "Знакомство",
    anonymous: false,
    questions: [
      open("t-intro-1", "С каким профессиональным запросом вы приехали на программу?", {
        hint: "Одно-два предложения: что хочется решить или понять",
        visual: "list",
      }),
    ],
  },
  {
    key: "expectations-cloud",
    title: "Ожидания от программы",
    description:
      "Облако слов из ожиданий участников. Хорошо работает на открытии: зал видит, с чем пришли коллеги.",
    purpose: "Открытие",
    anonymous: false,
    questions: [
      open("t-exp-1", "Одним словом: чего вы ждёте от программы?", { visual: "cloud" }),
    ],
  },
  {
    key: "day-reflection",
    title: "Рефлексия дня",
    description:
      "Оценка дня по шкале и открытый ответ о главном впечатлении. Запускается в конце каждого дня.",
    purpose: "Рефлексия",
    anonymous: false,
    questions: [
      scale("t-day-1", "Насколько день был полезен?", {
        min: "совсем нет",
        max: "очень полезен",
      }),
      open("t-day-2", "Что забираете с собой после сегодняшнего дня?", { visual: "list" }),
    ],
  },
  {
    key: "useful-most",
    title: "Что было самым полезным",
    description:
      "Облако слов по итогам блока: сразу видно, какие темы и формулировки зацепили участников.",
    purpose: "Обратная связь",
    anonymous: true,
    questions: [
      open("t-use-1", "Какая мысль или инструмент оказались самыми полезными?", {
        visual: "cloud",
      }),
    ],
  },
  {
    key: "myths-quiz",
    title: "Квиз: проверка знаний",
    description:
      "Четыре вопроса с одним верным вариантом, очками и лидербордом на экране. Время на ответ — 30 секунд.",
    purpose: "Квиз",
    anonymous: false,
    questions: [
      quiz("t-quiz-1", "Что такое «когнитивный долг» в работе с ИИ?", [
        ["Привычка перекладывать мышление на модель", true],
        ["Стоимость подписки на сервис", false],
        ["Ошибка в ответе модели", false],
        ["Время, потраченное на запрос", false],
      ]),
      quiz("t-quiz-2", "Что делает разговор о ценностях живым, а не формальным?", [
        ["Совместный опыт и действие", true],
        ["Готовые формулировки", false],
        ["Оценка за правильный ответ", false],
        ["Конспект вместо обсуждения", false],
      ]),
      quiz("t-quiz-3", "С чего начинается проектирование образовательного события?", [
        ["С ожидаемой перемены в человеке", true],
        ["С расписания", false],
        ["С выбора помещения", false],
        ["С количества участников", false],
      ]),
      quiz("t-quiz-4", "Как перевести глобальный вызов в школьную практику?", [
        ["Поставить профессиональную задачу", true],
        ["Сделать обзор мировых рейтингов", false],
        ["Провести доклад без обсуждения", false],
        ["Дождаться методических указаний", false],
      ]),
    ],
  },
  {
    key: "track-choice",
    title: "Выбор направления работы",
    description:
      "Один вариант из списка: помогает развести участников по трекам или проектным группам.",
    purpose: "Организация",
    anonymous: false,
    questions: [
      single("t-track-1", "В каком направлении хотите работать на проектном треке?", [
        "Работа с молодёжью",
        "Воспитательные практики в школе",
        "Медиа и кино",
        "Цифровые инструменты",
      ]),
    ],
  },
  {
    key: "topics-next",
    title: "Какие темы взять в работу",
    description:
      "Несколько вариантов ответа: участники выбирают темы, которые хотят продолжить после программы.",
    purpose: "Планирование",
    anonymous: false,
    questions: [
      multiple(
        "t-top-1",
        "Какие темы стоит разобрать подробнее?",
        [
          "Работа с ИИ в подготовке урока",
          "Разговор с классом о ценностях",
          "Наставничество и поддержка молодых педагогов",
          "Проектирование образовательных событий",
          "Работа с родителями",
          "Медиаграмотность школьников",
        ],
        "Можно отметить несколько тем",
      ),
    ],
  },
  {
    key: "program-rating",
    title: "Оценка программы",
    description:
      "Три шкалы по итогам программы: содержание, организация и работа экспертов. Готово к выгрузке в отчёт.",
    purpose: "Итоги",
    anonymous: true,
    questions: [
      scale("t-rate-1", "Содержание программы", { min: "не подошло", max: "полностью" }),
      scale("t-rate-2", "Организация и сопровождение", { min: "не подошло", max: "полностью" }),
      scale("t-rate-3", "Работа экспертов", { min: "не подошло", max: "полностью" }),
    ],
  },
];

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

function poll(input: Omit<Poll, "programSlug"> & { programSlug?: string }): Poll {
  return { programSlug: "", ...input };
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

const KINOPEDAGOGIKA_POLL = poll({
  id: "poll-kino-dialog",
  title: "Разговор после фильма: что работает",
  description:
    "Живой опрос второго дня. Ведущий запускает вопросы по ходу практикума, ответы появляются на экране.",
  anonymous: false,
  createdAt: "2026-10-07T10:00:00+03:00",
  source: "custom",
  questions: [
    open("k-1", "Одним словом: каким получился разговор со школьниками после фильма?", {
      hint: "Пишите то, что первым приходит в голову",
      visual: "cloud",
    }),
    single("k-2", "Какой приём вы заберёте в практику?", [
      "Пауза после просмотра",
      "Вопрос вместо морали",
      "Разговор в парах",
      "Письменная рефлексия",
    ]),
    scale("k-3", "Насколько уверенно вы чувствуете себя в обсуждении фильма?", {
      min: "совсем нет",
      max: "полностью уверенно",
    }),
  ],
});

const KINOPEDAGOGIKA_EXPECTATIONS = poll({
  id: "poll-kino-expectations",
  title: "Ожидания от практикума",
  description: "Опрос на открытии программы: облако слов из ожиданий участников.",
  anonymous: false,
  createdAt: "2026-10-06T15:50:00+03:00",
  source: "template",
  templateKey: "expectations-cloud",
  questions: POLL_TEMPLATES.find((template) => template.key === "expectations-cloud")!.questions,
});

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

  if (program.slug === "kinopedagogika") {
    const cloudQuestion = KINOPEDAGOGIKA_POLL.questions[0];

    return {
      templates,
      polls: [KINOPEDAGOGIKA_POLL, KINOPEDAGOGIKA_EXPECTATIONS],
      sessions: [
        session({
          id: "session-kino-dialog",
          programSlug: program.slug,
          pollId: KINOPEDAGOGIKA_POLL.id,
          code: "2104",
          status: "live",
          currentIndex: 0,
          accepting: true,
          showResults: true,
          startedAt: "2026-10-07T11:20:00+03:00",
          responses: deterministicResponses({
            question: cloudQuestion,
            seed: 20261007,
            count: 17,
            members,
            anonymous: false,
            createdAt: "2026-10-07T11:24:00+03:00",
          }),
        }),
        session({
          id: "session-kino-expectations",
          programSlug: program.slug,
          pollId: KINOPEDAGOGIKA_EXPECTATIONS.id,
          code: "1873",
          status: "finished",
          currentIndex: 0,
          accepting: false,
          showResults: true,
          startedAt: "2026-10-06T16:00:00+03:00",
          finishedAt: "2026-10-06T16:20:00+03:00",
          responses: deterministicResponses({
            question: KINOPEDAGOGIKA_EXPECTATIONS.questions[0],
            seed: 4242,
            count: 15,
            members,
            anonymous: false,
            createdAt: "2026-10-06T16:05:00+03:00",
          }),
        }),
      ],
    };
  }

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

  const template = templates.find((item) => item.key === "expectations-cloud")!;
  const draft = poll({
    id: `poll-${program.slug}-expectations`,
    programSlug: program.slug,
    title: template.title,
    description: template.description,
    anonymous: template.anonymous,
    createdAt: `${program.startDate}T09:00:00+03:00`,
    source: "template",
    templateKey: template.key,
    questions: template.questions,
  });

  return {
    templates,
    polls: [draft],
    sessions: [
      session({
        id: `session-${program.slug}-draft`,
        programSlug: program.slug,
        pollId: draft.id,
        code: "0000",
        status: "draft",
        currentIndex: 0,
        accepting: false,
        showResults: false,
        responses: [],
      }),
    ],
  };
}
