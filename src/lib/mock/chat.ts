import { b, doc, link, mention, p, quote, ul } from "../rich";
import { MASCOT } from "../brand";
import type { ChatData, ChatMessage, Conversation, Member } from "../types";
import type { ProgramView } from "../data";
import { readKey } from "../chat-actions";

/**
 * Демонстрационные чаты программы: группы по направлениям и личные диалоги.
 * Участники вымышлены и нужны для вёрстки; реальные беседы появятся
 * вместе с базой данных на волне 5.
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

const KINOPEDAGOGIKA_CONVERSATIONS: Conversation[] = [
  conv({
    id: "kino-track-1",
    kind: "group",
    title: "Трек «Разговор после фильма»",
    topic: "Обсуждаем приёмы обсуждения кино со школьниками",
    emoji: "🎬",
    memberIds: [
      "u-mod-1",
      "u-p-01",
      "u-p-02",
      "u-p-03",
      "u-p-04",
      "u-p-05",
      "u-p-06",
      "u-p-07",
      "u-p-08",
    ],
    createdBy: "u-mod-1",
    createdAt: "2026-10-06T16:30:00+03:00",
  }),
  conv({
    id: "kino-org",
    kind: "group",
    title: "Организация и логистика",
    topic: "Трансферы, питание, расписание — вопросы по быту программы",
    emoji: "🚌",
    memberIds: ["u-admin", "u-mod-1", "u-mod-2", "u-p-02", "u-p-05"],
    createdBy: "u-admin",
    createdAt: "2026-10-06T14:00:00+03:00",
  }),
  conv({
    id: "kino-teams",
    kind: "group",
    title: "Проектные команды",
    topic: "Командная работа над сценариями занятий",
    emoji: "🧩",
    memberIds: ["u-mod-2", "u-p-09", "u-p-10", "u-p-11", "u-p-12", "u-p-13", "u-p-14"],
    createdBy: "u-mod-2",
    createdAt: "2026-10-06T17:00:00+03:00",
  }),
  conv({
    id: "kino-dm-maria",
    kind: "direct",
    memberIds: ["u-p-01", "u-mod-1"],
    createdBy: "u-p-01",
    createdAt: "2026-10-07T20:14:00+03:00",
  }),
  conv({
    id: "kino-dm-anna",
    kind: "direct",
    memberIds: ["u-p-05", "u-mod-1"],
    createdBy: "u-p-05",
    createdAt: "2026-10-08T07:38:00+03:00",
  }),
];

const KINOPEDAGOGIKA_MESSAGES: ChatMessage[] = [
  msg({
    id: "m1",
    conversationId: "kino-track-1",
    authorId: "u-mod-1",
    createdAt: "2026-10-07T09:12:00+03:00",
    body: doc(
      p(
        "Коллеги, сегодня в 13:00 собираем сценарии занятий. Приносите заготовки — разберём в группах по 7 минут на команду.",
      ),
    ),
    reactions: [{ emoji: "👍", count: 6, mine: false }],
  }),
  msg({
    id: "m2",
    conversationId: "kino-track-1",
    authorId: "u-p-03",
    createdAt: "2026-10-07T09:20:00+03:00",
    body: doc(p("А если занятие уже проводили — показывать результат или сам сценарий?")),
  }),
  msg({
    id: "m3",
    conversationId: "kino-track-1",
    authorId: "u-mod-1",
    createdAt: "2026-10-07T09:24:00+03:00",
    replyToId: "m2",
    body: doc(p("И то и другое: сначала сценарий, потом что получилось с классом. Так видно логику.")),
    reactions: [{ emoji: "👍", count: 3, mine: false }],
  }),
  msg({
    id: "m4",
    conversationId: "kino-track-1",
    authorId: "u-p-07",
    createdAt: "2026-10-07T09:41:00+03:00",
    body: doc(
      p(
        "У меня был очень тихий класс. Разговор пошёл только после второго показа — оказывается, нужна пауза перед вопросами.",
      ),
    ),
  }),
  msg({
    id: "m5",
    conversationId: "kino-track-1",
    authorId: "u-p-01",
    createdAt: "2026-10-07T09:52:00+03:00",
    body: doc(p("Про паузу прямо в точку. Добавила в сценарий отдельный блок — 40 секунд тишины.")),
    reactions: [
      { emoji: "🔥", count: 4, mine: false },
      { emoji: "❤️", count: 2, mine: false },
    ],
  }),
  msg({
    id: "m6",
    conversationId: "kino-track-1",
    authorId: "u-mod-2",
    createdAt: "2026-10-07T18:05:00+03:00",
    body: doc(p("Фото с разбора — сохраните, пригодится для отчёта команды.")),
    attachments: [
      {
        id: "att-kino-1",
        kind: "image",
        url: MASCOT.front,
        alt: "Машутка на разборе сценариев",
      },
    ],
    reactions: [{ emoji: "❤️", count: 7, mine: false }],
  }),
  msg({
    id: "m7",
    conversationId: "kino-track-1",
    authorId: "u-mod-2",
    createdAt: "2026-10-08T08:30:00+03:00",
    body: doc(p("Доброе утро! Сегодня защита сценариев в 10:00, по 7 минут на команду.")),
    reactions: [{ emoji: "👍", count: 8, mine: false }],
  }),
  msg({
    id: "m8",
    conversationId: "kino-track-1",
    authorId: "u-p-05",
    createdAt: "2026-10-08T08:47:00+03:00",
    body: doc(p("Готовы. У нас три команды — успеем до обеда?")),
  }),
  msg({
    id: "m9",
    conversationId: "kino-track-1",
    authorId: "u-mod-2",
    createdAt: "2026-10-08T08:50:00+03:00",
    replyToId: "m8",
    body: doc(p("Успеем, у нас запас 15 минут. Начинаем ровно в 10:00.")),
  }),

  msg({
    id: "m10",
    conversationId: "kino-org",
    authorId: "u-admin",
    createdAt: "2026-10-06T18:10:00+03:00",
    body: doc(p("Автобус на завтрак в 8:30 от главного корпуса. Кто живёт в «Машуке» — сбор в холле.")),
    reactions: [{ emoji: "👍", count: 5, mine: false }],
  }),
  msg({
    id: "m11",
    conversationId: "kino-org",
    authorId: "u-mod-2",
    createdAt: "2026-10-06T18:15:00+03:00",
    body: doc(
      p("Напоминаю про восхождение в четверг: берите тёплые вещи, утром около +6 и ветер."),
    ),
  }),
  msg({
    id: "m12",
    conversationId: "kino-org",
    authorId: "u-p-02",
    createdAt: "2026-10-06T19:02:00+03:00",
    body: doc(p("А можно присоединиться к экскурсии по Пятигорску с семьёй?")),
  }),
  msg({
    id: "m13",
    conversationId: "kino-org",
    authorId: "u-admin",
    createdAt: "2026-10-06T19:20:00+03:00",
    replyToId: "m12",
    body: doc(p("Да, конечно. Напишите ", mention("Пётр"), " — добавим в список.")),
  }),
  msg({
    id: "m14",
    conversationId: "kino-org",
    authorId: "u-p-05",
    createdAt: "2026-10-06T20:11:00+03:00",
    body: doc(p("Спасибо за организацию, всё очень чётко.")),
    reactions: [{ emoji: "👏", count: 4, mine: false }],
  }),

  msg({
    id: "m15",
    conversationId: "kino-teams",
    authorId: "u-mod-2",
    createdAt: "2026-10-07T15:20:00+03:00",
    body: doc(p("Команды, выложите по одному предложению: какую практику защищаете?")),
  }),
  msg({
    id: "m16",
    conversationId: "kino-teams",
    authorId: "u-p-09",
    createdAt: "2026-10-07T15:26:00+03:00",
    body: doc(p("Киноклуб раз в месяц с обсуждением по возрастным группам.")),
  }),
  msg({
    id: "m17",
    conversationId: "kino-teams",
    authorId: "u-p-11",
    createdAt: "2026-10-07T15:31:00+03:00",
    body: doc(p("Занятие «Выбор и последствия» на материале короткометражки.")),
  }),
  msg({
    id: "m18",
    conversationId: "kino-teams",
    authorId: "u-p-12",
    createdAt: "2026-10-07T15:40:00+03:00",
    body: doc(p("Папка фильмов с готовыми вопросами для классных руководителей.")),
  }),
  msg({
    id: "m19",
    conversationId: "kino-teams",
    authorId: "u-mod-2",
    createdAt: "2026-10-07T15:45:00+03:00",
    body: doc(
      p("Отлично — все три складываются в одну линию: клуб, занятие и методическая папка."),
      quote("От личного впечатления — к общему смыслу."),
    ),
    reactions: [{ emoji: "🎯", count: 5, mine: false }],
  }),

  msg({
    id: "m20",
    conversationId: "kino-dm-maria",
    authorId: "u-p-01",
    createdAt: "2026-10-07T20:15:00+03:00",
    body: doc(p("Ирина, добрый вечер. Можно принести на защиту занятие для 8 класса?")),
  }),
  msg({
    id: "m21",
    conversationId: "kino-dm-maria",
    authorId: "u-mod-1",
    createdAt: "2026-10-07T20:22:00+03:00",
    body: doc(p("Добрый! Да, конечно. Главное — покажите, как ведёте обсуждение после показа.")),
  }),
  msg({
    id: "m22",
    conversationId: "kino-dm-maria",
    authorId: "u-p-01",
    createdAt: "2026-10-07T20:24:00+03:00",
    body: doc(p("Спасибо! Завтра покажу.")),
  }),
  msg({
    id: "m23",
    conversationId: "kino-dm-maria",
    authorId: "u-mod-1",
    createdAt: "2026-10-07T20:25:00+03:00",
    body: doc(p("Отлично, до завтра. И посмотрите ", b("шаблон сценария"), " — он во втором дне.")),
  }),

  msg({
    id: "m24",
    conversationId: "kino-dm-anna",
    authorId: "u-p-05",
    createdAt: "2026-10-08T07:40:00+03:00",
    body: doc(p("Ирина, подскажите, где взять шаблон сценария? В материалах не нашла.")),
  }),
  msg({
    id: "m25",
    conversationId: "kino-dm-anna",
    authorId: "u-mod-1",
    createdAt: "2026-10-08T07:52:00+03:00",
    body: doc(
      p(
        "Он во втором дне программы, файл «Шаблон сценария занятия». Сейчас продублирую ссылку в канал — там же и рабочие листы.",
      ),
    ),
  }),
];

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

/** Прочитано: у каждого участника свой набор. */
function kinoReadState(): Record<string, string> {
  return {
    [readKey("u-p-01", "kino-track-1")]: "2026-10-07T10:05:00+03:00",
    [readKey("u-p-01", "kino-org")]: "2026-10-06T20:11:00+03:00",
    [readKey("u-p-01", "kino-dm-maria")]: "2026-10-07T20:24:00+03:00",
    [readKey("u-mod-1", "kino-track-1")]: "2026-10-08T09:00:00+03:00",
    [readKey("u-mod-1", "kino-org")]: "2026-10-07T09:00:00+03:00",
    [readKey("u-mod-1", "kino-teams")]: "2026-10-07T16:00:00+03:00",
    [readKey("u-mod-1", "kino-dm-maria")]: "2026-10-07T21:00:00+03:00",
    [readKey("u-mod-1", "kino-dm-anna")]: "2026-10-08T00:00:00+03:00",
    [readKey("u-mod-2", "kino-track-1")]: "2026-10-08T09:00:00+03:00",
    [readKey("u-mod-2", "kino-teams")]: "2026-10-07T16:00:00+03:00",
    [readKey("u-admin", "kino-org")]: "2026-10-07T09:00:00+03:00",
  };
}

function defaultChat(program: ProgramView, members: Member[]): ChatData {
  const participantIds = members
    .filter((member) => member.role === "participant")
    .map((member) => member.id);

  const general = conv({
    id: `${program.slug}-general`,
    programSlug: program.slug,
    kind: "group",
    title: "Общий чат участников",
    topic: "Свободное общение по программе",
    emoji: "💬",
    memberIds: ["u-admin", "u-mod-1", "u-mod-2", ...participantIds],
    createdBy: "u-admin",
    createdAt: `${program.startDate}T09:00:00+03:00`,
  });

  const org = conv({
    id: `${program.slug}-org`,
    programSlug: program.slug,
    kind: "group",
    title: "Организационные вопросы",
    topic: "Трансферы, жильё, расписание",
    emoji: "🚌",
    memberIds: ["u-admin", "u-mod-1", "u-mod-2", ...participantIds.slice(0, 4)],
    createdBy: "u-admin",
    createdAt: `${program.startDate}T09:05:00+03:00`,
  });

  const direct = conv({
    id: `${program.slug}-dm-1`,
    programSlug: program.slug,
    kind: "direct",
    memberIds: ["u-p-01", "u-mod-1"],
    createdBy: "u-p-01",
    createdAt: `${program.startDate}T10:00:00+03:00`,
  });

  return {
    conversations: [general, org, direct],
    messages: [
      msg({
        id: `${program.slug}-gm1`,
        conversationId: general.id,
        authorId: "u-admin",
        createdAt: `${program.startDate}T09:30:00+03:00`,
        body: doc(
          p(`Добро пожаловать на программу «${program.title}»! Это чат участников — знакомьтесь и задавайте вопросы.`),
        ),
        reactions: [{ emoji: "👋", count: 5, mine: false }],
      }),
      msg({
        id: `${program.slug}-gm2`,
        conversationId: general.id,
        authorId: "u-mod-1",
        createdAt: `${program.startDate}T09:45:00+03:00`,
        body: doc(p("Расписание и материалы — в канале программы и в разделе «Материалы».")),
      }),
      msg({
        id: `${program.slug}-gm3`,
        conversationId: org.id,
        authorId: "u-mod-2",
        createdAt: `${program.startDate}T10:10:00+03:00`,
        body: doc(p("Заселение с 14:00. Кто приезжает раньше — напишите, встретим.")),
      }),
      msg({
        id: `${program.slug}-dm1`,
        conversationId: direct.id,
        authorId: "u-mod-1",
        createdAt: `${program.startDate}T11:00:00+03:00`,
        body: doc(p("Мария, добрый день! Если понадобится помощь по программе — пишите сюда.")),
      }),
    ],
    readState: {
      [readKey("u-p-01", general.id)]: `${program.startDate}T09:45:00+03:00`,
      [readKey("u-p-01", direct.id)]: `${program.startDate}T10:59:00+03:00`,
      [readKey("u-mod-1", general.id)]: `${program.startDate}T12:00:00+03:00`,
      [readKey("u-mod-1", direct.id)]: `${program.startDate}T12:00:00+03:00`,
    },
  };
}

export function getMockChatData(program: ProgramView, members: Member[]): ChatData {
  if (program.slug === "kinopedagogika") {
    return {
      conversations: KINOPEDAGOGIKA_CONVERSATIONS,
      messages: KINOPEDAGOGIKA_MESSAGES,
      readState: kinoReadState(),
    };
  }

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

  return defaultChat(program, members);
}
