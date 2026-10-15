/** Сезонные схемы фирменного стиля (руководство, стр. 11–14). */
export type SeasonKey = "spring" | "summer" | "autumn" | "winter";

/** Статус программы: набор, идёт, завершена. */
export type ProgramStatus = "recruiting" | "ongoing" | "finished";

/** Направление программы — используется для фильтров витрины. */
export type DirectionKey =
  | "international"
  | "media"
  | "digital"
  | "mentoring"
  | "management";

export interface Slot {
  time: string;
  title: string;
  description?: string;
  speakers?: string[];
  tag?: string;
}

export interface ProgramDay {
  day: number;
  /** ISO-дата начала дня */
  date: string;
  theme: string;
  slots: Slot[];
}

export interface MaterialLink {
  label: string;
  url: string;
}

export interface ProgramMaterial {
  id: string;
  /** Номер дня, к которому относится блок */
  day: number;
  kind: string;
  title: string;
  description?: string;
  speakers?: string[];
  links: MaterialLink[];
}

export interface Fact {
  value: string;
  label: string;
}

export interface Program {
  slug: string;
  title: string;
  /** Надзаголовок: «Международный образовательный семинар» */
  subtitle: string;
  stream?: string;
  direction: DirectionKey;
  /** ISO-даты */
  startDate: string;
  endDate: string;
  location: string;
  /** Если не задан — вычисляется по дате начала */
  season?: SeasonKey;
  participants?: number;
  format?: string;
  hero: {
    lead: string;
    facts: Fact[];
  };
  about: {
    lead: string;
    quote?: { text: string; caption?: string };
    blocks: { title: string; text: string }[];
  };
  results: { title: string; text: string }[];
  days: ProgramDay[];
  materials: ProgramMaterial[];
  note?: string;
  /** Авторский одностраничник на GitVerse Pages, который готовит команда Центра */
  landing?: { url: string; code?: string };
  /** Общая папка с материалами программы */
  driveFolder?: string;
  /** Программа ведётся в демонстрационном режиме (мок-данные) */
  demo?: boolean;
  /** Загружена авторская сборка программы (HTML) — открывается внутри хаба */
  hasBuild?: boolean;
}

export interface Direction {
  key: DirectionKey;
  label: string;
}

/** Программа с вычисленными сезоном и статусом — то, что видят страницы. */
export interface ProgramView extends Program {
  season: SeasonKey;
  status: ProgramStatus;
}

export const DIRECTIONS: Direction[] = [
  { key: "international", label: "Международные программы" },
  { key: "media", label: "Медиа и кинопедагогика" },
  { key: "digital", label: "Цифровые компетенции" },
  { key: "mentoring", label: "Наставничество" },
  { key: "management", label: "Управление в образовании" },
];

/* ==========================================================================
   Хаб программы: участники, канал, обсуждение
   ========================================================================== */

export type MemberRole = "admin" | "moderator" | "participant";

export interface Member {
  id: string;
  name: string;
  role: MemberRole;
  /** Должность и место работы — показываются в списке участников */
  position?: string;
  org?: string;
  city?: string;
}

/**
 * Документ редактора в формате TipTap JSON.
 * Хранится как структура, а не как HTML: это исключает вставку
 * произвольной разметки и позволяет рендерить контент без dangerouslySetInnerHTML.
 */
export interface RichMark {
  type: string;
  attrs?: Record<string, unknown>;
}

export interface RichNode {
  type: string;
  text?: string;
  marks?: RichMark[];
  attrs?: Record<string, unknown>;
  content?: RichNode[];
}

export interface RichDoc {
  type: "doc";
  content: RichNode[];
}

export interface Attachment {
  id: string;
  kind: "image";
  url: string;
  alt: string;
}

export interface ReactionSummary {
  emoji: string;
  count: number;
  /** Реакция текущего пользователя */
  mine: boolean;
}

export interface Comment {
  id: string;
  authorId: string;
  body: RichDoc;
  createdAt: string;
  reactions: ReactionSummary[];
  replies: Comment[];
}

export interface Post {
  id: string;
  programSlug: string;
  authorId: string;
  title?: string;
  body: RichDoc;
  attachments: Attachment[];
  createdAt: string;
  pinned: boolean;
  reactions: ReactionSummary[];
  comments: Comment[];
}

export interface HubData {
  members: Member[];
  posts: Post[];
  /** Кто «вошёл» в хаб — в демо-режиме переключается пользователем */
  currentUserId: string;
}

export const MEMBER_ROLE_LABELS: Record<MemberRole, string> = {
  admin: "Администратор",
  moderator: "Модератор",
  participant: "Участник",
};

export const REACTION_SET = ["👍", "❤️", "🔥", "👏", "🎯", "🤔"] as const;

/* ==========================================================================
   Опросы, квизы и живые сессии
   ========================================================================== */

/** Тип вопроса: то, что выбирает автор опроса в конструкторе. */
export type QuestionKind =
  | "single"
  | "multiple"
  | "open"
  | "cloud"
  | "qa"
  | "rank"
  | "spinner"
  | "scale"
  | "quiz";

/** Как показывать открытые ответы: списком или облаком слов. */
export type OpenVisual = "cloud" | "list";

export interface QuestionOption {
  id: string;
  text: string;
  /** Верный вариант — только для квиза */
  correct?: boolean;
}

export interface Question {
  id: string;
  kind: QuestionKind;
  title: string;
  hint?: string;
  options: QuestionOption[];
  /** Подписи полюсов шкалы: «совсем нет» — «полностью да» */
  scaleLabels?: { min: string; max: string };
  visual?: OpenVisual;
  /** Ограничение времени в секундах, 0 — без ограничения */
  timeLimit: number;
  points: number;
}

export interface Poll {
  id: string;
  programSlug: string;
  title: string;
  description?: string;
  questions: Question[];
  anonymous: boolean;
  /** Командный квиз: 0 — личный зачёт, иначе число команд */
  teamCount: number;
  createdAt: string;
  source: "template" | "custom";
  templateKey?: string;
}

export interface AnswerValue {
  optionIds: string[];
  text?: string;
  scale?: number;
}

export interface PollResponse {
  id: string;
  questionId: string;
  /** Пусто, если опрос анонимный */
  memberId?: string;
  /** Ответ текущего пользователя */
  mine?: boolean;
  value: AnswerValue;
  createdAt: string;
  /** Q&A: скрыт модератором */
  hidden?: boolean;
  /** Q&A: отмечен как отвеченный */
  answered?: boolean;
  /** Q&A: сколько голосов за вопрос */
  votes?: number;
  /** Q&A: голосовал ли текущий пользователь */
  voted?: boolean;
}

export type SessionStatus = "draft" | "live" | "finished";

export interface PollSession {
  id: string;
  pollId: string;
  programSlug: string;
  /** Код для входа участников с телефона */
  code: string;
  status: SessionStatus;
  currentIndex: number;
  /** Открыт ли приём ответов на текущий вопрос */
  accepting: boolean;
  showResults: boolean;
  responses: PollResponse[];
  startedAt?: string;
  finishedAt?: string;
}

export interface PollTemplate {
  key: string;
  title: string;
  description: string;
  /** Для какой ситуации шаблон: знакомство, рефлексия, проверка знаний */
  purpose: string;
  anonymous: boolean;
  questions: Question[];
}

export interface PollData {
  polls: Poll[];
  sessions: PollSession[];
  templates: PollTemplate[];
}

export const QUESTION_KIND_LABELS: Record<QuestionKind, string> = {
  single: "Один вариант",
  multiple: "Несколько вариантов",
  open: "Список ответов",
  cloud: "Облако слов",
  qa: "Вопросы и ответы",
  rank: "Ранжирование",
  spinner: "Колесо",
  scale: "Шкала 1–5",
  quiz: "Вопрос квиза",
};

export const QUESTION_KIND_HINTS: Record<QuestionKind, string> = {
  single: "Участник выбирает один вариант из списка",
  multiple: "Можно отметить несколько вариантов",
  open: "Свободный текст: показывается списком",
  cloud: "Свободный текст: показывается облаком слов",
  qa: "Зал задаёт вопросы — они появляются списком на экране",
  rank: "Участник расставляет варианты по порядку — считается средний ранг",
  spinner: "Колесо на экране: ведущий крутит, выпадает случайный вариант",
  scale: "Оценка по пятибалльной шкале со средним значением",
  quiz: "Один верный вариант, очки и лидерборд на экране",
};

/* ==========================================================================
   Чаты программы: группы по направлениям и личные диалоги
   ========================================================================== */

export type ConversationKind = "group" | "direct";

export interface Conversation {
  id: string;
  programSlug: string;
  kind: ConversationKind;
  /** Название группы; у личного диалога не задаётся */
  title?: string;
  topic?: string;
  emoji?: string;
  memberIds: string[];
  createdBy: string;
  createdAt: string;
}

export interface ChatMessage {
  id: string;
  conversationId: string;
  authorId: string;
  body: RichDoc;
  attachments: Attachment[];
  createdAt: string;
  reactions: ReactionSummary[];
  /** Ответ на конкретное сообщение */
  replyToId?: string;
}

export interface ChatData {
  conversations: Conversation[];
  messages: ChatMessage[];
  /**
   * Что прочитано: ключ «участник:беседа» → время последнего прочитанного сообщения.
   * Хранится по каждому участнику, потому что счётчик непрочитанных у всех свой.
   */
  readState: Record<string, string>;
}

export const MAX_GROUP_MEMBERS = 60;



