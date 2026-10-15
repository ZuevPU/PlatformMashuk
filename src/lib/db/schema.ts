import {
  boolean,
  date,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  unique,
} from "drizzle-orm/pg-core";
import type {
  Attachment,
  DirectionKey,
  MemberRole,
  OpenVisual,
  QuestionKind,
  QuestionOption,
  ReactionSummary,
  RichDoc,
  SeasonKey,
  SessionStatus,
  ConversationKind,
} from "../types";

/* ==========================================================================
   Схема базы данных платформы

   Имена в базе — snake_case, в TypeScript — camelCase.
   Структурированное содержимое (тексты постов, варианты ответов, вложения)
   хранится в jsonb: это документы редактора и небольшие списки, которые
   читаются вместе с записью и не требуют отдельных таблиц.
   Реакции вынесены в отдельную таблицу: они принадлежат конкретному участнику.
   ========================================================================== */

export const programs = pgTable(
  "programs",
  {
    id: serial("id").primaryKey(),
    slug: text("slug").notNull().unique(),
    title: text("title").notNull(),
    subtitle: text("subtitle").notNull(),
    stream: text("stream"),
    direction: text("direction").$type<DirectionKey>().notNull(),
    startDate: date("start_date").notNull(),
    endDate: date("end_date").notNull(),
    location: text("location").notNull(),
    season: text("season").$type<SeasonKey>(),
    participants: integer("participants"),
    format: text("format"),
    heroLead: text("hero_lead").notNull(),
    heroFacts: jsonb("hero_facts").$type<{ value: string; label: string }[]>().notNull().default([]),
    aboutLead: text("about_lead").notNull(),
    aboutBlocks: jsonb("about_blocks").$type<{ title: string; text: string }[]>().notNull().default([]),
    quoteText: text("quote_text"),
    quoteCaption: text("quote_caption"),
    results: jsonb("results").$type<{ title: string; text: string }[]>().notNull().default([]),
    note: text("note"),
    landingUrl: text("landing_url"),
    landingCode: text("landing_code"),
    driveFolder: text("drive_folder"),
    isDemo: boolean("is_demo").notNull().default(false),
    /** Пароль программы (scrypt-хеш): по нему новый участник попадает в программу */
    accessPasswordHash: text("access_password_hash"),
    /** Когда загружена авторская сборка программы (HTML); null — сборки нет */
    buildUploadedAt: timestamp("build_uploaded_at", { withTimezone: true }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [index("programs_start_date_idx").on(table.startDate)],
);

export const programDays = pgTable(
  "program_days",
  {
    id: serial("id").primaryKey(),
    programId: integer("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    day: integer("day").notNull(),
    date: date("date").notNull(),
    theme: text("theme").notNull(),
  },
  (table) => [unique("program_days_program_day_key").on(table.programId, table.day)],
);

export const programSlots = pgTable("program_slots", {
  id: serial("id").primaryKey(),
  dayId: integer("day_id")
    .notNull()
    .references(() => programDays.id, { onDelete: "cascade" }),
  position: integer("position").notNull(),
  time: text("time").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  speakers: jsonb("speakers").$type<string[]>().notNull().default([]),
  tag: text("tag"),
});

export const programMaterials = pgTable("program_materials", {
  id: serial("id").primaryKey(),
  programId: integer("program_id")
    .notNull()
    .references(() => programs.id, { onDelete: "cascade" }),
  code: text("code").notNull(),
  day: integer("day").notNull(),
  kind: text("kind").notNull(),
  title: text("title").notNull(),
  description: text("description"),
  speakers: jsonb("speakers").$type<string[]>().notNull().default([]),
  links: jsonb("links").$type<{ label: string; url: string }[]>().notNull().default([]),
});

/**
 * Человек на платформе. Роль admin — администратор Центра: видит все программы
 * и управляет ими. Роль в конкретной программе — в program_members.
 */
export const members = pgTable("members", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  role: text("role").$type<MemberRole>().notNull(),
  position: text("position"),
  org: text("org"),
  city: text("city"),
  /** Почта или телефон в нормализованном виде — это логин */
  contact: text("contact").unique(),
  /** Личный пароль (scrypt-хеш); null — человек ещё не входил */
  passwordHash: text("password_hash"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
});

export const programMembers = pgTable(
  "program_members",
  {
    programId: integer("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    role: text("role").$type<MemberRole>().notNull(),
  },
  (table) => [
    primaryKey({ columns: [table.programId, table.memberId] }),
    index("program_members_member_idx").on(table.memberId),
  ],
);

/* --- Реакции: одна строка = один участник и один эмодзи ---------------- */

export const reactions = pgTable(
  "reactions",
  {
    id: serial("id").primaryKey(),
    targetType: text("target_type").$type<"post" | "comment" | "message">().notNull(),
    targetId: text("target_id").notNull(),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    emoji: text("emoji").notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [
    unique("reactions_unique_key").on(
      table.targetType,
      table.targetId,
      table.memberId,
      table.emoji,
    ),
    index("reactions_target_idx").on(table.targetType, table.targetId),
  ],
);

/* --- Канал программы ---------------------------------------------------- */

export const posts = pgTable(
  "posts",
  {
    id: text("id").primaryKey(),
    programId: integer("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => members.id),
    title: text("title"),
    body: jsonb("body").$type<RichDoc>().notNull(),
    attachments: jsonb("attachments").$type<Attachment[]>().notNull().default([]),
    pinned: boolean("pinned").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("posts_program_idx").on(table.programId, table.createdAt)],
);

export const comments = pgTable(
  "comments",
  {
    id: text("id").primaryKey(),
    postId: text("post_id")
      .notNull()
      .references(() => posts.id, { onDelete: "cascade" }),
    parentId: text("parent_id"),
    authorId: text("author_id")
      .notNull()
      .references(() => members.id),
    body: jsonb("body").$type<RichDoc>().notNull(),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("comments_post_idx").on(table.postId, table.createdAt)],
);

/* --- Опросы ------------------------------------------------------------- */

export const polls = pgTable("polls", {
  id: text("id").primaryKey(),
  programId: integer("program_id")
    .notNull()
    .references(() => programs.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  description: text("description"),
  anonymous: boolean("anonymous").notNull().default(false),
  source: text("source").$type<"template" | "custom">().notNull().default("custom"),
  templateKey: text("template_key"),
  /** Командный квиз: 0 — личный зачёт, иначе число команд */
  teamCount: integer("team_count").notNull().default(0),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
});

export const pollQuestions = pgTable(
  "poll_questions",
  {
    id: text("id").primaryKey(),
    pollId: text("poll_id")
      .notNull()
      .references(() => polls.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    kind: text("kind").$type<QuestionKind>().notNull(),
    title: text("title").notNull(),
    hint: text("hint"),
    options: jsonb("options").$type<QuestionOption[]>().notNull().default([]),
    scaleLabels: jsonb("scale_labels").$type<{ min: string; max: string }>(),
    visual: text("visual").$type<OpenVisual>(),
    timeLimit: integer("time_limit").notNull().default(0),
    points: integer("points").notNull().default(0),
  },
  (table) => [index("poll_questions_poll_idx").on(table.pollId, table.position)],
);

export const pollSessions = pgTable(
  "poll_sessions",
  {
    id: text("id").primaryKey(),
    pollId: text("poll_id")
      .notNull()
      .references(() => polls.id, { onDelete: "cascade" }),
    code: text("code").notNull(),
    status: text("status").$type<SessionStatus>().notNull().default("draft"),
    currentIndex: integer("current_index").notNull().default(0),
    accepting: boolean("accepting").notNull().default(false),
    showResults: boolean("show_results").notNull().default(false),
    startedAt: timestamp("started_at", { withTimezone: true }),
    finishedAt: timestamp("finished_at", { withTimezone: true }),
  },
  (table) => [index("poll_sessions_poll_idx").on(table.pollId)],
);

export const pollResponses = pgTable(
  "poll_responses",
  {
    id: text("id").primaryKey(),
    sessionId: text("session_id")
      .notNull()
      .references(() => pollSessions.id, { onDelete: "cascade" }),
    questionId: text("question_id")
      .notNull()
      .references(() => pollQuestions.id, { onDelete: "cascade" }),
    memberId: text("member_id").references(() => members.id, { onDelete: "set null" }),
    /**
     * Обезличенный ключ отвечающего: HMAC от участника и сессии. Не даёт ответить
     * на вопрос дважды и при этом не раскрывает, кто ответил в анонимном опросе.
     */
    respondentKey: text("respondent_key"),
    optionIds: jsonb("option_ids").$type<string[]>().notNull().default([]),
    text: text("text"),
    scale: integer("scale"),
    /** Q&A: вопрос скрыт модератором */
    hidden: boolean("hidden").notNull().default(false),
    /** Q&A: вопрос отмечен как отвеченный */
    answered: boolean("answered").notNull().default(false),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [
    index("poll_responses_session_idx").on(table.sessionId, table.questionId),
    unique("poll_responses_respondent_key").on(
      table.sessionId,
      table.questionId,
      table.respondentKey,
    ),
  ],
);

/**
 * Голоса за вопросы зала (Q&A): одна строка — один участник и один вопрос.
 * Отсортированный по голосам список выводится на экран ведущего.
 */
export const qaVotes = pgTable(
  "qa_votes",
  {
    responseId: text("response_id")
      .notNull()
      .references(() => pollResponses.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  },
  (table) => [primaryKey({ columns: [table.responseId, table.memberId] })],
);

/* --- Чаты --------------------------------------------------------------- */
export const conversations = pgTable(
  "conversations",
  {
    id: text("id").primaryKey(),
    programId: integer("program_id")
      .notNull()
      .references(() => programs.id, { onDelete: "cascade" }),
    kind: text("kind").$type<ConversationKind>().notNull(),
    title: text("title"),
    topic: text("topic"),
    emoji: text("emoji"),
    /** Общий чат: каждый, кто входит в программу, становится участником автоматически */
    autoJoin: boolean("auto_join").notNull().default(false),
    createdBy: text("created_by")
      .notNull()
      .references(() => members.id),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("conversations_program_idx").on(table.programId)],
);

export const conversationMembers = pgTable(
  "conversation_members",
  {
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
  },
  (table) => [
    primaryKey({ columns: [table.conversationId, table.memberId] }),
    index("conversation_members_member_idx").on(table.memberId),
  ],
);

export const messages = pgTable(
  "messages",
  {
    id: text("id").primaryKey(),
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    authorId: text("author_id")
      .notNull()
      .references(() => members.id),
    body: jsonb("body").$type<RichDoc>().notNull(),
    attachments: jsonb("attachments").$type<Attachment[]>().notNull().default([]),
    replyToId: text("reply_to_id"),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull(),
  },
  (table) => [index("messages_conversation_idx").on(table.conversationId, table.createdAt)],
);

export const chatReadState = pgTable(
  "chat_read_state",
  {
    conversationId: text("conversation_id")
      .notNull()
      .references(() => conversations.id, { onDelete: "cascade" }),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    lastReadAt: timestamp("last_read_at", { withTimezone: true }).notNull(),
  },
  (table) => [primaryKey({ columns: [table.conversationId, table.memberId] })],
);

/** Тип для агрегатов реакций, собираемых запросом. */
export type ReactionRow = ReactionSummary;

/* ==========================================================================
   Вход: личный пароль участника или пароль программы
   ========================================================================== */

/**
 * Счётчик попыток входа: защита от перебора паролей.
 * Ключ — назначение и источник, например «login:ip:1.2.3.4» или «login:contact:…».
 */
export const loginAttempts = pgTable("login_attempts", {
  key: text("key").primaryKey(),
  attempts: integer("attempts").notNull().default(0),
  windowStart: timestamp("window_start", { withTimezone: true }).notNull().defaultNow(),
  blockedUntil: timestamp("blocked_until", { withTimezone: true }),
});

/** Активная сессия: непрозрачный токен в cookie, ничего больше в браузере. */
export const authSessions = pgTable(
  "auth_sessions",
  {
    token: text("token").primaryKey(),
    memberId: text("member_id")
      .notNull()
      .references(() => members.id, { onDelete: "cascade" }),
    createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
    expiresAt: timestamp("expires_at", { withTimezone: true }).notNull(),
    userAgent: text("user_agent"),
  },
  (table) => [index("auth_sessions_member_idx").on(table.memberId)],
);

