import { b, doc, h, i, link, mention, p, quote, ul } from "../rich";
import type { Comment, HubData, Member, Post } from "../types";
import { MASCOT, LOGOS } from "../brand";
import type { ProgramView } from "../data";

/**
 * Демонстрационные данные хаба программы — источник для seed.
 *
 * Участники вымышлены и нужны, чтобы канал, обсуждения и роли не были пустыми.
 * Эксперты в тексте постов упомянуты по данным авторского одностраничника
 * программы «Образование на высоте».
 */

const ADMIN: Member = {
  id: "u-admin",
  name: "Команда Центра «Машук»",
  role: "admin",
  position: "Куратор программы",
  org: "АНО «Центр знаний «Машук»",
  city: "Пятигорск",
};

const MODERATORS: Member[] = [
  {
    id: "u-mod-1",
    name: "Ирина Дорохова",
    role: "moderator",
    position: "Методист программы",
    org: "АНО «Центр знаний «Машук»",
    city: "Пятигорск",
  },
  {
    id: "u-mod-2",
    name: "Пётр Савельев",
    role: "moderator",
    position: "Координатор потока",
    org: "АНО «Центр знаний «Машук»",
    city: "Пятигорск",
  },
];

const PARTICIPANTS: Member[] = [
  { id: "u-p-01", name: "Мария Ковалёва", position: "Учитель истории", org: "Школа № 14", city: "Казань" },
  { id: "u-p-02", name: "Артём Лебедев", position: "Заместитель директора", org: "Гимназия № 3", city: "Тверь" },
  { id: "u-p-03", name: "Ольга Никитина", position: "Учитель русского языка", org: "Лицей № 7", city: "Самара" },
  { id: "u-p-04", name: "Дмитрий Гордеев", position: "Педагог-организатор", org: "Школа № 22", city: "Пермь" },
  { id: "u-p-05", name: "Анна Родионова", position: "Советник по воспитанию", org: "Школа № 5", city: "Вологда" },
  { id: "u-p-06", name: "Сергей Панов", position: "Учитель информатики", org: "Лицей № 1", city: "Курск" },
  { id: "u-p-07", name: "Екатерина Волкова", position: "Методист", org: "Институт развития образования", city: "Тюмень" },
  { id: "u-p-08", name: "Никита Ершов", position: "Учитель географии", org: "Школа № 31", city: "Иркутск" },
  { id: "u-p-09", name: "Полина Захарова", position: "Учитель начальных классов", org: "Школа № 9", city: "Рязань" },
  { id: "u-p-10", name: "Илья Мещеряков", position: "Педагог дополнительного образования", org: "Дом детского творчества", city: "Смоленск" },
  { id: "u-p-11", name: "Татьяна Белова", position: "Учитель биологии", org: "Школа № 17", city: "Астрахань" },
  { id: "u-p-12", name: "Роман Старцев", position: "Учитель физики", org: "Лицей № 4", city: "Барнаул" },
  { id: "u-p-13", name: "Юлия Андреева", position: "Психолог", org: "Школа № 26", city: "Псков" },
  { id: "u-p-14", name: "Максим Гончаров", position: "Учитель музыки", org: "Школа № 12", city: "Тула" },
  { id: "u-p-15", name: "Светлана Ильина", position: "Учитель литературы", org: "Гимназия № 8", city: "Кострома" },
  { id: "u-p-16", name: "Андрей Фомин", position: "Учитель ОБЖ", org: "Школа № 19", city: "Брянск" },
  { id: "u-p-17", name: "Наталья Гусева", position: "Завуч по воспитательной работе", org: "Школа № 3", city: "Череповец" },
  { id: "u-p-18", name: "Виктор Крылов", position: "Учитель истории", org: "Лицей № 6", city: "Орёл" },
  { id: "u-p-19", name: "Дарья Соколова", position: "Педагог-психолог", org: "Школа № 24", city: "Мурманск" },
  { id: "u-p-20", name: "Егор Матвеев", position: "Учитель технологии", org: "Школа № 11", city: "Киров" },
  { id: "u-p-21", name: "Ксения Орлова", position: "Учитель английского языка", org: "Гимназия № 2", city: "Владимир" },
  { id: "u-p-22", name: "Павел Дьяконов", position: "Учитель математики", org: "Школа № 30", city: "Ульяновск" },
  { id: "u-p-23", name: "Алина Кузнецова", position: "Советник директора", org: "Школа № 7", city: "Липецк" },
  { id: "u-p-24", name: "Григорий Тарасов", position: "Учитель физкультуры", org: "Школа № 15", city: "Белгород" },
  { id: "u-p-25", name: "Вера Максимова", position: "Учитель начальных классов", org: "Школа № 28", city: "Курган" },
  { id: "u-p-26", name: "Олег Сафонов", position: "Методист", org: "Центр развития образования", city: "Ярославль" },
].map((member) => ({ ...member, id: member.id, role: "participant" as const }));

export const HUB_MEMBERS: Member[] = [ADMIN, ...MODERATORS, ...PARTICIPANTS];

export function findMember(id: string): Member | undefined {
  return HUB_MEMBERS.find((member) => member.id === id);
}

function comment(
  id: string,
  authorId: string,
  body: Comment["body"],
  createdAt: string,
  reactions: Comment["reactions"] = [],
  replies: Comment[] = [],
): Comment {
  return { id, authorId, body, createdAt, reactions, replies };
}

function post(
  input: Omit<Post, "programSlug" | "pinned"> & { programSlug?: string; pinned?: boolean },
): Post {
  return { programSlug: "", pinned: false, ...input };
}

const OBRAZOVANIE_POSTS: Post[] = [
  post({
    id: "ov-1",
    authorId: ADMIN.id,
    title: "Итоги программы и материалы",
    pinned: true,
    createdAt: "2026-10-03T12:00:00+03:00",
    body: doc(
      p("Коллеги, программа завершена. Собрали все материалы по дням и итоговый одностраничник — ссылки в посте «Итоги программы»."),
      h(3, "Что осталось у вас после программы"),
      ul([
        ["Рамка будущего: технологические и медиавызовы, которые уже меняют образование."],
        ["Ценностная опора: как переводить разговор о ценностях в совместный опыт."],
        ["Инструменты: проектирование образовательных событий и рефлексии."],
        ["Проектные решения команд — в общем сборнике."],
      ]),
      p("Канал остаётся рабочим: пишите, если нужна помощь с внедрением или хотите поделиться результатом."),
    ),
    attachments: [
      { id: "att-ov-1", kind: "image", url: LOGOS.full, alt: "Центр знаний «Машук»" },
    ],
    reactions: [
      { emoji: "❤️", count: 58, mine: false },
      { emoji: "👏", count: 44, mine: false },
      { emoji: "🔥", count: 19, mine: false },
    ],
    comments: [
      comment(
        "ov-1-c1",
        "u-p-07",
        doc(p("Спасибо за материалы. Уже провели с коллегами разбор панели про воспитательную работу — очень откликнулось.")),
        "2026-10-03T14:10:00+03:00",
        [{ emoji: "🔥", count: 8, mine: false }],
      ),
      comment(
        "ov-1-c2",
        "u-p-02",
        doc(p("Будет ли продолжение — встреча сообщества через месяц?")),
        "2026-10-04T09:30:00+03:00",
        [],
        [
          comment(
            "ov-1-c2-r1",
            ADMIN.id,
            doc(p("Да, планируем онлайн-встречу сообщества. Анонс пришлём сюда и на почту.")),
            "2026-10-04T10:05:00+03:00",
            [{ emoji: "🎯", count: 11, mine: false }],
          ),
        ],
      ),
    ],
  }),
  post({
    id: "ov-2",
    authorId: MODERATORS[0].id,
    title: "Проектные решения команд",
    createdAt: "2026-10-02T09:15:00+03:00",
    body: doc(
      p("Собрали решения команд по итогам проектного трека. Спасибо за работу — было видно, как глобальные вызовы превращаются в конкретные школьные практики."),
      quote("От глобального вызова — к профессиональной задаче, практике и способу оценки."),
      p("Если хотите доработать свою практику до публикации — напишите, поможем с оформлением."),
    ),
    attachments: [],
    reactions: [
      { emoji: "👏", count: 37, mine: false },
      { emoji: "🎯", count: 22, mine: false },
    ],
    comments: [
      comment(
        "ov-2-c1",
        "u-p-04",
        doc(p("Наша команда как раз дописывает описание практики. Куда прислать?")),
        "2026-10-02T11:40:00+03:00",
        [],
        [
          comment(
            "ov-2-c1-r1",
            MODERATORS[0].id,
            doc(p("Ответил в личных сообщениях, присылайте в удобном формате.")),
            "2026-10-02T12:02:00+03:00",
          ),
        ],
      ),
    ],
  }),
];

export function getMockHub(program: ProgramView): HubData {
  const authored = program.slug === "obrazovanie-na-vysote" ? OBRAZOVANIE_POSTS : [];
  const posts = authored.map((item) => ({
    ...item,
    programSlug: program.slug,
  }));

  // Показываем состав в пределах демонстрационного пула
  const participantsCount = Math.min(PARTICIPANTS.length, program.participants ?? 12);
  const members = [ADMIN, ...MODERATORS, ...PARTICIPANTS.slice(0, participantsCount)];

  return {
    members,
    posts: [...posts].sort(
      (a, b2) => Number(b2.pinned) - Number(a.pinned) || b2.createdAt.localeCompare(a.createdAt),
    ),
    currentUserId: "u-p-01",
  };
}
