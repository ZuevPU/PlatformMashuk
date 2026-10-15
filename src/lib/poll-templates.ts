import type { PollTemplate, Question } from "./types";

/**
 * Библиотека шаблонов опросов — конфигурация приложения, а не демо-данные:
 * ведущий собирает опрос из шаблона за пару кликов.
 */

/* ==========================================================================
   Конструкторы вопросов
   ========================================================================== */

export function open(
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

export function single(
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

export function multiple(id: string, title: string, options: string[], hint?: string): Question {
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

export function scale(
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

export function quiz(
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
