import { b, doc, link, mention, p, quote, ul } from "../rich";
import { MASCOT } from "../brand";
import type { ChatData, ChatMessage, Conversation } from "../types";
import type { ProgramView } from "../data";
import { readKey } from "../chat-actions";

/**
 * Демонстрационные чаты программы — источник для seed:
 * группы по направлениям и личные диалоги.
 */

function conv(input: Omit<Conversation, "programSlug"> & { programSlug?: string }): Conversation {
  return { programSlug: "", ...input };
}

function msg(input: {
  id: string;
  conversationId: string;
  authorId: string;
  createdAt: string;
  body: ChatMessage["body"];
  attachments?: ChatMessage["attachments"];
  reactions?: ChatMessage["reactions"];
  replyToId?: string;
}): ChatMessage {
  return {
    id: input.id,
    conversationId: input.conversationId,
    authorId: input.authorId,
    body: input.body,
    attachments: input.attachments ?? [],
    createdAt: input.createdAt,
    reactions: input.reactions ?? [],
    replyToId: input.replyToId,
  };
}

const OBRAZOVANIE_CONVERSATIONS: Conversation[] = [
  conv({
    id: "ov-alumni",
    kind: "group",
    title: "Сообщество выпускников",
    topic: "Живём после программы: практики, вопросы, поддержка",
    emoji: "🎓",
    memberIds: [
      "u-admin",
      "u-mod-1",
      "u-p-01",
      "u-p-02",
      "u-p-03",
      "u-p-04",
      "u-p-05",
      "u-p-06",
    ],
    createdBy: "u-admin",
    createdAt: "2026-09-30T12:00:00+03:00",
  }),
  conv({
    id: "ov-projects",
    kind: "group",
    title: "Проектные решения команд",
    topic: "Дорабатываем практики до публикации",
    emoji: "🧩",
    memberIds: ["u-mod-1", "u-mod-2", "u-p-07", "u-p-08", "u-p-09", "u-p-10"],
    createdBy: "u-mod-1",
    createdAt: "2026-10-01T09:00:00+03:00",
  }),
  conv({
    id: "ov-dm-maria",
    kind: "direct",
    memberIds: ["u-p-01", "u-mod-1"],
    createdBy: "u-p-01",
    createdAt: "2026-10-03T10:00:00+03:00",
  }),
];

const OBRAZOVANIE_MESSAGES: ChatMessage[] = [
  msg({
    id: "o1",
    conversationId: "ov-alumni",
    authorId: "u-admin",
    createdAt: "2026-10-03T12:10:00+03:00",
    body: doc(
      p("Коллеги, программа завершена, но канал остаётся рабочим. Присылайте, что удалось внедрить."),
    ),
    reactions: [{ emoji: "❤️", count: 12, mine: false }],
  }),
  msg({
    id: "o2",
    conversationId: "ov-alumni",
    authorId: "u-p-03",
    createdAt: "2026-10-04T09:30:00+03:00",
    body: doc(
      p(
        "Провели с коллегами разбор панели про воспитательную работу — взяли структуру «среда, семья, объединения».",
      ),
    ),
    reactions: [{ emoji: "🔥", count: 6, mine: false }],
  }),
  msg({
    id: "o3",
    conversationId: "ov-alumni",
    authorId: "u-mod-1",
    createdAt: "2026-10-05T11:15:00+03:00",
    body: doc(
      p("Собираем онлайн-встречу сообщества через месяц. Темы складываем ", mention("Команда"), " — пишите в комментариях."),
      ul([
        ["как удержать разговор о ценностях в расписании"],
        ["где брать время на проектные форматы"],
      ]),
    ),
  }),
  msg({
    id: "o4",
    conversationId: "ov-alumni",
    authorId: "u-p-01",
    createdAt: "2026-10-06T18:40:00+03:00",
    body: doc(p("Голосую за первую тему. У нас как раз встал этот вопрос на педсовете.")),
  }),

  msg({
    id: "o5",
    conversationId: "ov-projects",
    authorId: "u-mod-1",
    createdAt: "2026-10-04T10:05:00+03:00",
    body: doc(
      p(
        "Кто хочет довести практику до публикации — поможем с оформлением. Ориентир: одна страница, задача, действие, результат.",
      ),
    ),
    reactions: [{ emoji: "🎯", count: 7, mine: false }],
  }),
  msg({
    id: "o6",
    conversationId: "ov-projects",
    authorId: "u-p-07",
    createdAt: "2026-10-04T14:20:00+03:00",
    body: doc(p("Присылаю черновик описания, посмотрите структуру.")),
  }),
  msg({
    id: "o7",
    conversationId: "ov-projects",
    authorId: "u-mod-2",
    createdAt: "2026-10-04T16:02:00+03:00",
    replyToId: "o6",
    body: doc(
      p("Посмотрел: логика есть, добавьте только способ оценки результата — и можно публиковать."),
      p("Материалы по оформлению — ", link("в общей папке программы", "https://drive.google.com/drive/folders/1Nu1Um7PgmB9kks-EFLmKGpYqSyfkJwas"), "."),
    ),
    reactions: [{ emoji: "👍", count: 4, mine: false }],
  }),

  msg({
    id: "o8",
    conversationId: "ov-dm-maria",
    authorId: "u-mod-1",
    createdAt: "2026-10-05T12:00:00+03:00",
    body: doc(p("Мария, добрый день! Готовы помочь с описанием вашей практики. Пришлёте черновик?")),
  }),
  msg({
    id: "o9",
    conversationId: "ov-dm-maria",
    authorId: "u-p-01",
    createdAt: "2026-10-05T13:20:00+03:00",
    body: doc(p("Да, спасибо! Соберу к концу недели.")),
    reactions: [{ emoji: "👍", count: 2, mine: false }],
  }),
];

export function getMockChatData(program: ProgramView): ChatData {
  if (program.slug === "obrazovanie-na-vysote") {
    return {
      conversations: OBRAZOVANIE_CONVERSATIONS,
      messages: OBRAZOVANIE_MESSAGES,
      readState: {
        [readKey("u-p-01", "ov-alumni")]: "2026-10-06T18:40:00+03:00",
        [readKey("u-p-01", "ov-dm-maria")]: "2026-10-05T13:20:00+03:00",
        [readKey("u-mod-1", "ov-alumni")]: "2026-10-07T10:00:00+03:00",
        [readKey("u-mod-1", "ov-projects")]: "2026-10-05T10:00:00+03:00",
        [readKey("u-mod-1", "ov-dm-maria")]: "2026-10-06T10:00:00+03:00",
      },
    };
  }

  return { conversations: [], messages: [], readState: {} };
}
