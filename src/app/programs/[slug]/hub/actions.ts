"use server";

import { randomInt, randomUUID } from "node:crypto";
import { and, eq, inArray, ne, sql } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { getViewer } from "@/lib/auth";
import { publish } from "@/lib/events";
import { respondentKey } from "@/lib/respondent";
import {
  cleanAttachments,
  cleanText,
  isClientId,
  isId,
  isReaction,
  isRichDoc,
} from "@/lib/validate";
import { MAX_GROUP_MEMBERS } from "@/lib/types";
import type { MemberRole, QuestionKind, QuestionOption, RichDoc } from "@/lib/types";

/**
 * Запись в хаб программы.
 *
 * Серверное действие — публичная точка входа, поэтому каждое проверяет:
 * сессию и роль в программе, что объект принадлежит этой программе,
 * и сами данные. Автор всегда берётся из сессии, а не из запроса.
 *
 * Идентификаторы новых постов, комментариев, сообщений и бесед создаёт
 * браузер (префикс + UUID): так оптимистичная запись в интерфейсе и запись
 * в базе совпадают, и при обновлении данных ничего не задваивается.
 *
 * После записи публикуется событие — открытые страницы получают его
 * потоком и подтягивают изменения.
 */

type ActionResult = { ok: true } | { ok: false; error: string };

interface Context {
  memberId: string;
  role: MemberRole;
  programId: number;
  staff: boolean;
}

const fail = (error: string): { ok: false; error: string } => ({ ok: false, error });

async function requireContext(
  programSlug: unknown,
  options: { staff?: boolean } = {},
): Promise<{ context: Context } | { error: string }> {
  const db = getDb();
  if (!db) return { error: "База данных не подключена" };
  if (!isId(programSlug)) return { error: "Программа не найдена" };

  const viewer = await getViewer(programSlug);
  if (!viewer) return { error: "Войдите в программу, чтобы продолжить" };

  const staff = viewer.role === "admin" || viewer.role === "moderator";
  if (options.staff && !staff) return { error: "Это может сделать только команда программы" };

  return {
    context: { memberId: viewer.user.member.id, role: viewer.role, programId: viewer.programId, staff },
  };
}

/* --- Канал --------------------------------------------------------------- */

export async function createPostAction(input: {
  programSlug: string;
  id: string;
  title?: string;
  body: RichDoc;
  attachments: unknown;
}): Promise<ActionResult> {
  const db = getDb();
  const result = await requireContext(input.programSlug, { staff: true });
  if ("error" in result || !db) return fail((result as { error: string }).error);

  const attachments = cleanAttachments(input.attachments);
  if (!isClientId("post", input.id) || !isRichDoc(input.body) || !attachments) {
    return fail("Не удалось прочитать пост");
  }

  await db
    .insert(schema.posts)
    .values({
      id: input.id,
      programId: result.context.programId,
      authorId: result.context.memberId,
      title: cleanText(input.title, 200) ?? null,
      body: input.body,
      attachments,
      pinned: false,
      createdAt: new Date(),
    })
    .onConflictDoNothing();

  publish({ type: "channel", programSlug: input.programSlug });
  return { ok: true };
}

export async function addCommentAction(input: {
  programSlug: string;
  id: string;
  postId: string;
  parentId?: string;
  body: RichDoc;
}): Promise<ActionResult> {
  const db = getDb();
  const result = await requireContext(input.programSlug);
  if ("error" in result || !db) return fail((result as { error: string }).error);

  if (!isClientId("comment", input.id) || !isId(input.postId) || !isRichDoc(input.body)) {
    return fail("Не удалось прочитать комментарий");
  }

  const [post] = await db
    .select({ id: schema.posts.id })
    .from(schema.posts)
    .where(
      and(eq(schema.posts.id, input.postId), eq(schema.posts.programId, result.context.programId)),
    );
  if (!post) return fail("Пост не найден");

  if (input.parentId !== undefined) {
    if (!isId(input.parentId)) return fail("Комментарий не найден");
    const [parent] = await db
      .select({ id: schema.comments.id })
      .from(schema.comments)
      .where(and(eq(schema.comments.id, input.parentId), eq(schema.comments.postId, post.id)));
    if (!parent) return fail("Комментарий не найден");
  }

  await db
    .insert(schema.comments)
    .values({
      id: input.id,
      postId: post.id,
      parentId: input.parentId ?? null,
      authorId: result.context.memberId,
      body: input.body,
      createdAt: new Date(),
    })
    .onConflictDoNothing();

  publish({ type: "channel", programSlug: input.programSlug });
  return { ok: true };
}

export async function togglePinAction(input: {
  programSlug: string;
  postId: string;
  pinned: boolean;
}): Promise<ActionResult> {
  const db = getDb();
  const result = await requireContext(input.programSlug, { staff: true });
  if ("error" in result || !db) return fail((result as { error: string }).error);
  if (!isId(input.postId)) return fail("Пост не найден");

  await db
    .update(schema.posts)
    .set({ pinned: Boolean(input.pinned) })
    .where(
      and(eq(schema.posts.id, input.postId), eq(schema.posts.programId, result.context.programId)),
    );

  publish({ type: "channel", programSlug: input.programSlug });
  return { ok: true };
}

/* --- Реакции ------------------------------------------------------------- */

/** Принадлежит ли объект программе и доступен ли он человеку. Для сообщений — участники беседы. */
async function reactionTarget(
  targetType: "post" | "comment" | "message",
  targetId: string,
  context: Context,
): Promise<{ memberIds?: string[]; conversationId?: string } | null> {
  const db = getDb();
  if (!db) return null;

  if (targetType === "post") {
    const [row] = await db
      .select({ id: schema.posts.id })
      .from(schema.posts)
      .where(and(eq(schema.posts.id, targetId), eq(schema.posts.programId, context.programId)));
    return row ? {} : null;
  }

  if (targetType === "comment") {
    const [row] = await db
      .select({ id: schema.comments.id })
      .from(schema.comments)
      .innerJoin(schema.posts, eq(schema.posts.id, schema.comments.postId))
      .where(and(eq(schema.comments.id, targetId), eq(schema.posts.programId, context.programId)));
    return row ? {} : null;
  }

  const [row] = await db
    .select({ conversationId: schema.messages.conversationId })
    .from(schema.messages)
    .innerJoin(schema.conversations, eq(schema.conversations.id, schema.messages.conversationId))
    .where(
      and(eq(schema.messages.id, targetId), eq(schema.conversations.programId, context.programId)),
    );
  if (!row) return null;

  const memberIds = await conversationMemberIds(row.conversationId);
  return memberIds.includes(context.memberId)
    ? { memberIds, conversationId: row.conversationId }
    : null;
}

export async function toggleReactionAction(input: {
  programSlug: string;
  targetType: "post" | "comment" | "message";
  targetId: string;
  emoji: string;
}): Promise<ActionResult> {
  const db = getDb();
  const result = await requireContext(input.programSlug);
  if ("error" in result || !db) return fail((result as { error: string }).error);

  if (
    !["post", "comment", "message"].includes(input.targetType) ||
    !isId(input.targetId) ||
    !isReaction(input.emoji)
  ) {
    return fail("Не удалось поставить реакцию");
  }

  const target = await reactionTarget(input.targetType, input.targetId, result.context);
  if (!target) return fail("Не найдено");

  const where = and(
    eq(schema.reactions.targetType, input.targetType),
    eq(schema.reactions.targetId, input.targetId),
    eq(schema.reactions.memberId, result.context.memberId),
    eq(schema.reactions.emoji, input.emoji),
  );

  const removed = await db.delete(schema.reactions).where(where).returning({ id: schema.reactions.id });
  if (removed.length === 0) {
    await db
      .insert(schema.reactions)
      .values({
        targetType: input.targetType,
        targetId: input.targetId,
        memberId: result.context.memberId,
        emoji: input.emoji,
        createdAt: new Date(),
      })
      .onConflictDoNothing();
  }

  if (input.targetType === "message" && target.conversationId && target.memberIds) {
    publish({
      type: "message",
      programSlug: input.programSlug,
      conversationId: target.conversationId,
      memberIds: target.memberIds,
    });
  } else {
    publish({ type: "channel", programSlug: input.programSlug });
  }
  return { ok: true };
}

/** Удаление поста из канала — команда программы (администратор/модератор). */
export async function deletePostAction(input: {
  programSlug: string;
  postId: string;
}): Promise<ActionResult> {
  const db = getDb();
  const result = await requireContext(input.programSlug, { staff: true });
  if ("error" in result || !db) return fail((result as { error: string }).error);
  if (!isId(input.postId)) return fail("Пост не найден");

  const deleted = await db
    .delete(schema.posts)
    .where(
      and(
        eq(schema.posts.id, input.postId),
        eq(schema.posts.programId, result.context.programId),
      ),
    )
    .returning({ id: schema.posts.id });
  if (deleted.length === 0) return fail("Пост не найден");

  publish({ type: "channel", programSlug: input.programSlug });
  return { ok: true };
}

/* --- Опросы ------------------------------------------------------------- */

const KINDS: QuestionKind[] = [
  "single",
  "multiple",
  "open",
  "cloud",
  "qa",
  "rank",
  "spinner",
  "scale",
  "quiz",
];

/**
 * Ответ участника на текущий вопрос живой сессии.
 *
 * Анонимность определяет сервер по настройке опроса, а не браузер.
 * В анонимном опросе участник не записывается — хранится только
 * обезличенный ключ, который не даёт ответить дважды.
 */
export async function submitPollResponseAction(input: {
  programSlug: string;
  sessionId: string;
  questionId: string;
  value: { optionIds: string[]; text?: string; scale?: number };
}): Promise<ActionResult> {
  const db = getDb();
  const result = await requireContext(input.programSlug);
  if ("error" in result || !db) return fail((result as { error: string }).error);
  if (!isId(input.sessionId) || !isId(input.questionId)) return fail("Опрос не найден");

  // Сессия, опрос и вопрос — одним запросом: во время опроса это самое частое действие
  const [row] = await db
    .select({
      sessionId: schema.pollSessions.id,
      accepting: schema.pollSessions.accepting,
      status: schema.pollSessions.status,
      currentIndex: schema.pollSessions.currentIndex,
      anonymous: schema.polls.anonymous,
      questionId: schema.pollQuestions.id,
      kind: schema.pollQuestions.kind,
      options: schema.pollQuestions.options,
      position: schema.pollQuestions.position,
    })
    .from(schema.pollSessions)
    .innerJoin(schema.polls, eq(schema.polls.id, schema.pollSessions.pollId))
    .leftJoin(
      schema.pollQuestions,
      and(
        eq(schema.pollQuestions.pollId, schema.pollSessions.pollId),
        eq(schema.pollQuestions.id, input.questionId),
      ),
    )
    .where(
      and(
        eq(schema.pollSessions.id, input.sessionId),
        eq(schema.polls.programId, result.context.programId),
      ),
    );

  if (!row) return fail("Опрос не найден");
  if (row.status !== "live" || !row.accepting) return fail("Приём ответов закрыт");
  if (!row.questionId || !row.kind || row.position !== row.currentIndex) {
    return fail("Этот вопрос уже закрыт");
  }
  const session = { id: row.sessionId, anonymous: row.anonymous };
  const question = { id: row.questionId, kind: row.kind, options: row.options ?? [] };

  const value = cleanAnswer(question.kind, question.options, input.value);
  if (!value) return fail("Ответ не распознан");

  const { memberId } = result.context;
  // Q&A — поток вопросов от зала: отвечать можно много раз, поэтому
  // обезличенный ключ не ставится (уникальность по нему не срабатывает).
  const isQa = question.kind === "qa";
  const inserted = await db
    .insert(schema.pollResponses)
    .values({
      id: `response-${randomUUID()}`,
      sessionId: session.id,
      questionId: question.id,
      memberId: session.anonymous ? null : memberId,
      respondentKey: isQa ? null : respondentKey(memberId, session.id),
      optionIds: value.optionIds,
      text: value.text ?? null,
      scale: value.scale ?? null,
      createdAt: new Date(),
    })
    .onConflictDoNothing()
    .returning({ id: schema.pollResponses.id });

  if (inserted.length === 0) return fail("Вы уже ответили на этот вопрос");

  publish({
    type: "poll-responses",
    programSlug: input.programSlug,
    sessionId: session.id,
    questionId: question.id,
  });
  return { ok: true };
}

function cleanAnswer(
  kind: QuestionKind,
  options: QuestionOption[],
  value: { optionIds?: unknown; text?: unknown; scale?: unknown } | undefined,
): { optionIds: string[]; text?: string; scale?: number } | null {
  if (!value || typeof value !== "object") return null;

  // Колесо не собирает ответов — его крутит ведущий
  if (kind === "spinner") return null;

  if (kind === "rank") {
    const known = new Set(options.map((option) => option.id));
    const ids = Array.isArray(value.optionIds)
      ? value.optionIds.filter((id): id is string => typeof id === "string" && known.has(id))
      : [];
    const unique = [...new Set(ids)];
    return unique.length >= 2 ? { optionIds: unique } : null;
  }

  if (kind === "open" || kind === "cloud" || kind === "qa") {
    const text = cleanText(value.text, 300);
    return text ? { optionIds: [], text } : null;
  }

  if (kind === "scale") {
    const scale = Number(value.scale);
    return Number.isInteger(scale) && scale >= 1 && scale <= 5 ? { optionIds: [], scale } : null;
  }

  const known = new Set(options.map((option) => option.id));
  const ids = Array.isArray(value.optionIds)
    ? [...new Set(value.optionIds.filter((id): id is string => typeof id === "string" && known.has(id)))]
    : [];
  if (ids.length === 0) return null;
  if (kind !== "multiple" && ids.length > 1) return null;
  return { optionIds: ids };
}

/**
 * Четырёхзначный код сессии, свободный среди незавершённых опросов.
 * По коду участник входит в опрос (/poll/<код>) и строится QR — поэтому
 * код должен указывать однозначно.
 */
async function uniqueCode(db: NonNullable<ReturnType<typeof getDb>>): Promise<string> {
  for (let attempt = 0; attempt < 25; attempt += 1) {
    const candidate = String(randomInt(1000, 10000));
    const [clash] = await db
      .select({ id: schema.pollSessions.id })
      .from(schema.pollSessions)
      .where(and(eq(schema.pollSessions.code, candidate), ne(schema.pollSessions.status, "finished")))
      .limit(1);
    if (!clash) return candidate;
  }
  return String(randomInt(1000, 10000));
}

/**
 * Сохранение нового опроса вместе с черновиком сессии.
 *
 * Идентификаторы вопросов строит сервер: они получают префикс опроса,
 * поэтому вопросы шаблонов не конфликтуют между программами.
 */
export async function createPollAction(input: {
  programSlug: string;
  title: string;
  description?: string;
  anonymous: boolean;
  /** Командный квиз: 0 — личный зачёт, иначе число команд (2–6) */
  teamCount?: number;
  source: "template" | "custom";
  templateKey?: string;
  questions: {
    kind: string;
    title: string;
    hint?: string;
    options: { id: string; text: string; correct?: boolean }[];
    scaleLabels?: { min: string; max: string };
    visual?: string;
    timeLimit: number;
    points: number;
  }[];
}): Promise<
  | { ok: true; pollId: string; sessionId: string; code: string; questionIds: string[] }
  | { ok: false; error: string }
> {
  const db = getDb();
  const result = await requireContext(input.programSlug, { staff: true });
  if ("error" in result || !db) return fail((result as { error: string }).error);

  const title = cleanText(input.title, 200);
  if (!title) return fail("Назовите опрос");
  if (!Array.isArray(input.questions) || input.questions.length === 0 || input.questions.length > 50) {
    return fail("В опросе должен быть хотя бы один вопрос");
  }

  const questions: Omit<typeof schema.pollQuestions.$inferInsert, "id" | "pollId" | "position">[] =
    [];
  for (const question of input.questions) {
    const questionTitle = cleanText(question?.title, 300);
    if (!questionTitle || !KINDS.includes(question.kind as QuestionKind)) {
      return fail("У каждого вопроса должен быть текст");
    }
    const kind = question.kind as QuestionKind;
    const options = Array.isArray(question.options)
      ? question.options.slice(0, 20).map((option, index) => ({
          id: isId(option?.id) ? option.id : `opt-${index + 1}`,
          text: cleanText(option?.text, 200) ?? `Вариант ${index + 1}`,
          ...(option?.correct ? { correct: true } : {}),
        }))
      : [];
    if (
      (kind === "single" || kind === "multiple" || kind === "quiz" || kind === "rank" || kind === "spinner") &&
      options.length < 2
    ) {
      return fail("В вопросе с вариантами нужно хотя бы два варианта");
    }
    questions.push({
      kind,
      title: questionTitle,
      hint: cleanText(question.hint, 300) ?? null,
      options,
      scaleLabels:
        kind === "scale" && question.scaleLabels
          ? {
              min: cleanText(question.scaleLabels.min, 60) ?? "",
              max: cleanText(question.scaleLabels.max, 60) ?? "",
            }
          : null,
      visual:
        kind === "cloud"
          ? "cloud"
          : kind === "open"
            ? question.visual === "cloud"
              ? "cloud"
              : "list"
            : null,
      timeLimit: Math.max(0, Math.min(600, Math.round(Number(question.timeLimit) || 0))),
      points: Math.max(0, Math.min(1000, Math.round(Number(question.points) || 0))),
    });
  }

  const pollId = `poll-${randomUUID()}`;
  const sessionId = `session-${randomUUID()}`;
  const code = await uniqueCode(db);
  const questionIds = questions.map((_, index) => `${pollId}--q${index + 1}`);

  await db.transaction(async (tx) => {
    await tx.insert(schema.polls).values({
      id: pollId,
      programId: result.context.programId,
      title,
      description: cleanText(input.description, 600) ?? null,
      anonymous: Boolean(input.anonymous),
      teamCount: Math.max(0, Math.min(6, Math.round(Number(input.teamCount) || 0))),
      source: input.source === "template" ? "template" : "custom",
      templateKey: cleanText(input.templateKey, 80) ?? null,
      createdAt: new Date(),
    });

    await tx.insert(schema.pollQuestions).values(
      questions.map((question, index) => ({ ...question, id: questionIds[index], pollId, position: index })),
    );

    await tx.insert(schema.pollSessions).values({
      id: sessionId,
      pollId,
      code,
      status: "draft",
      currentIndex: 0,
      accepting: false,
      showResults: false,
    });
  });

  publish({ type: "polls", programSlug: input.programSlug });
  return { ok: true, pollId, sessionId, code, questionIds };
}

/** Удаление опроса вместе с вопросами, сессиями и ответами (каскадом). */
export async function deletePollAction(input: {
  programSlug: string;
  pollId: string;
}): Promise<ActionResult> {
  const db = getDb();
  const result = await requireContext(input.programSlug, { staff: true });
  if ("error" in result || !db) return fail((result as { error: string }).error);
  if (!isId(input.pollId)) return fail("Опрос не найден");

  const deleted = await db
    .delete(schema.polls)
    .where(
      and(
        eq(schema.polls.id, input.pollId),
        eq(schema.polls.programId, result.context.programId),
      ),
    )
    .returning({ id: schema.polls.id });
  if (deleted.length === 0) return fail("Опрос не найден");

  publish({ type: "polls", programSlug: input.programSlug });
  return { ok: true };
}

/* --- Авто-закрытие вопроса по времени ----------------------------------- */

const globalAutoClose = globalThis as unknown as {
  __mashukAutoClose?: Map<string, ReturnType<typeof setTimeout>>;
};

function autoCloseTimers(): Map<string, ReturnType<typeof setTimeout>> {
  if (!globalAutoClose.__mashukAutoClose) globalAutoClose.__mashukAutoClose = new Map();
  return globalAutoClose.__mashukAutoClose;
}

function clearAutoClose(sessionId: string): void {
  const timers = autoCloseTimers();
  const existing = timers.get(sessionId);
  if (existing) {
    clearTimeout(existing);
    timers.delete(sessionId);
  }
}

/**
 * Сервер сам закрывает приём ответов, когда у текущего вопроса вышло время.
 * Платформа живёт в одном процессе, поэтому обычного setTimeout достаточно;
 * при нескольких экземплярах здесь понадобится общая очередь.
 */
function scheduleAutoClose(input: {
  programSlug: string;
  sessionId: string;
  seconds: number;
  currentIndex: number;
  showResults: boolean;
}): void {
  const timers = autoCloseTimers();
  const timer = setTimeout(
    async () => {
      timers.delete(input.sessionId);
      const db = getDb();
      if (!db) return;
      try {
        await db
          .update(schema.pollSessions)
          .set({ accepting: false })
          .where(eq(schema.pollSessions.id, input.sessionId));
        publish({
          type: "poll-session",
          programSlug: input.programSlug,
          sessionId: input.sessionId,
          status: "live",
          currentIndex: input.currentIndex,
          accepting: false,
          showResults: input.showResults,
        });
      } catch {
        // база недоступна — состояние перечитается при следующем действии
      }
    },
    Math.min(input.seconds, 600) * 1000 + 500,
  );
  timers.set(input.sessionId, timer);
}

/** Состояние живой сессии: запуск, переход по вопросам, приём ответов, завершение. */
export async function updatePollSessionAction(input: {  programSlug: string;
  sessionId: string;
  status: "draft" | "live" | "finished";
  currentIndex: number;
  accepting: boolean;
  showResults: boolean;
}): Promise<ActionResult> {
  const db = getDb();
  const result = await requireContext(input.programSlug, { staff: true });
  if ("error" in result || !db) return fail((result as { error: string }).error);
  if (!isId(input.sessionId) || !["draft", "live", "finished"].includes(input.status)) {
    return fail("Сессия не найдена");
  }

  // Сессия должна принадлежать опросу этой программы
  const [session] = await db
    .select({
      id: schema.pollSessions.id,
      pollId: schema.pollSessions.pollId,
      status: schema.pollSessions.status,
      questions: sql<number>`(select count(*)::int from poll_questions q where q.poll_id = ${schema.pollSessions.pollId})`,
    })
    .from(schema.pollSessions)
    .innerJoin(schema.polls, eq(schema.polls.id, schema.pollSessions.pollId))
    .where(
      and(
        eq(schema.pollSessions.id, input.sessionId),
        eq(schema.polls.programId, result.context.programId),
      ),
    );
  if (!session) return fail("Сессия не найдена");

  const currentIndex = Math.max(
    0,
    Math.min(Number(session.questions) - 1, Math.round(Number(input.currentIndex) || 0)),
  );
  const state = {
    status: input.status,
    currentIndex,
    accepting: input.status === "live" && Boolean(input.accepting),
    showResults: Boolean(input.showResults),
  };

  await db
    .update(schema.pollSessions)
    .set({
      ...state,
      ...(input.status === "live" && session.status !== "live" ? { startedAt: new Date() } : {}),
      ...(input.status === "finished" && session.status !== "finished"
        ? { finishedAt: new Date() }
        : {}),
    })
    .where(eq(schema.pollSessions.id, session.id));

  // В программе идёт только один опрос: запуск нового завершает прежний,
  // чтобы в зале не смешивались два активных опроса.
  if (state.status === "live") {
    await db
      .update(schema.pollSessions)
      .set({ status: "finished", accepting: false, finishedAt: new Date() })
      .where(
        and(
          ne(schema.pollSessions.id, session.id),
          eq(schema.pollSessions.status, "live"),
          inArray(
            schema.pollSessions.pollId,
            db
              .select({ id: schema.polls.id })
              .from(schema.polls)
              .where(eq(schema.polls.programId, result.context.programId)),
          ),
        ),
      );
    publish({ type: "polls", programSlug: input.programSlug });
  }

  publish({ type: "poll-session", programSlug: input.programSlug, sessionId: session.id, ...state });

  // Таймер вопроса: по истечении сервер сам закрывает приём ответов
  clearAutoClose(session.id);
  if (state.accepting) {
    const [currentQuestion] = await db
      .select({ timeLimit: schema.pollQuestions.timeLimit })
      .from(schema.pollQuestions)
      .where(
        and(
          eq(schema.pollQuestions.pollId, session.pollId),
          eq(schema.pollQuestions.position, currentIndex),
        ),
      )
      .limit(1);
    if (currentQuestion && currentQuestion.timeLimit > 0) {
      scheduleAutoClose({
        programSlug: input.programSlug,
        sessionId: session.id,
        seconds: currentQuestion.timeLimit,
        currentIndex,
        showResults: state.showResults,
      });
    }
  }

  return { ok: true };
}

/**
 * Модерация вопросов зала (Q&A): скрыть или отметить отвеченным.
 * Доступно только команде программы.
 */
export async function moderateQaResponseAction(input: {
  programSlug: string;
  sessionId: string;
  responseId: string;
  patch: { hidden?: boolean; answered?: boolean };
}): Promise<ActionResult> {
  const db = getDb();
  const result = await requireContext(input.programSlug, { staff: true });
  if ("error" in result || !db) return fail((result as { error: string }).error);
  if (!isId(input.sessionId) || !isId(input.responseId)) return fail("Вопрос не найден");

  const [row] = await db
    .select({ id: schema.pollResponses.id })
    .from(schema.pollResponses)
    .innerJoin(schema.pollSessions, eq(schema.pollSessions.id, schema.pollResponses.sessionId))
    .innerJoin(schema.polls, eq(schema.polls.id, schema.pollSessions.pollId))
    .where(
      and(
        eq(schema.pollResponses.id, input.responseId),
        eq(schema.pollResponses.sessionId, input.sessionId),
        eq(schema.polls.programId, result.context.programId),
      ),
    );
  if (!row) return fail("Вопрос не найден");

  const patch: { hidden?: boolean; answered?: boolean } = {};
  if (typeof input.patch.hidden === "boolean") patch.hidden = input.patch.hidden;
  if (typeof input.patch.answered === "boolean") patch.answered = input.patch.answered;
  if (Object.keys(patch).length === 0) return { ok: true };

  await db
    .update(schema.pollResponses)
    .set(patch)
    .where(eq(schema.pollResponses.id, input.responseId));

  publish({
    type: "poll-responses",
    programSlug: input.programSlug,
    sessionId: input.sessionId,
    questionId: "",
  });
  return { ok: true };
}

/** Голос за вопрос зала: один голос на участника, повторный — снимает. */
export async function toggleQaVoteAction(input: {
  programSlug: string;
  sessionId: string;
  responseId: string;
}): Promise<ActionResult> {
  const db = getDb();
  const result = await requireContext(input.programSlug);
  if ("error" in result || !db) return fail((result as { error: string }).error);
  if (!isId(input.sessionId) || !isId(input.responseId)) return fail("Вопрос не найден");

  const [row] = await db
    .select({ id: schema.pollResponses.id })
    .from(schema.pollResponses)
    .innerJoin(schema.pollSessions, eq(schema.pollSessions.id, schema.pollResponses.sessionId))
    .innerJoin(schema.polls, eq(schema.polls.id, schema.pollSessions.pollId))
    .where(
      and(
        eq(schema.pollResponses.id, input.responseId),
        eq(schema.pollResponses.sessionId, input.sessionId),
        eq(schema.polls.programId, result.context.programId),
      ),
    );
  if (!row) return fail("Вопрос не найден");

  const { memberId } = result.context;
  const where = and(
    eq(schema.qaVotes.responseId, input.responseId),
    eq(schema.qaVotes.memberId, memberId),
  );
  const existing = await db.select({ memberId: schema.qaVotes.memberId }).from(schema.qaVotes).where(where);

  if (existing.length > 0) {
    await db.delete(schema.qaVotes).where(where);
  } else {
    await db
      .insert(schema.qaVotes)
      .values({ responseId: input.responseId, memberId, createdAt: new Date() })
      .onConflictDoNothing();
  }

  publish({
    type: "poll-responses",
    programSlug: input.programSlug,
    sessionId: input.sessionId,
    questionId: "",
  });
  return { ok: true };
}

/* --- Чаты --------------------------------------------------------------- */

async function conversationMemberIds(conversationId: string): Promise<string[]> {
  const db = getDb();
  if (!db) return [];
  const rows = await db
    .select({ memberId: schema.conversationMembers.memberId })
    .from(schema.conversationMembers)
    .where(eq(schema.conversationMembers.conversationId, conversationId));
  return rows.map((row) => row.memberId);
}

/** Беседа программы, в которой состоит человек. */
async function ownConversation(conversationId: unknown, context: Context) {
  const db = getDb();
  if (!db || !isId(conversationId)) return null;

  const [conversation] = await db
    .select({ id: schema.conversations.id })
    .from(schema.conversations)
    .where(
      and(
        eq(schema.conversations.id, conversationId),
        eq(schema.conversations.programId, context.programId),
      ),
    );
  if (!conversation) return null;

  const memberIds = await conversationMemberIds(conversation.id);
  return memberIds.includes(context.memberId) ? { id: conversation.id, memberIds } : null;
}

export async function sendMessageAction(input: {
  programSlug: string;
  id: string;
  conversationId: string;
  body: RichDoc;
  attachments: unknown;
  replyToId?: string;
}): Promise<ActionResult> {
  const db = getDb();
  const result = await requireContext(input.programSlug);
  if ("error" in result || !db) return fail((result as { error: string }).error);

  const attachments = cleanAttachments(input.attachments);
  if (!isClientId("msg", input.id) || !isRichDoc(input.body) || !attachments) {
    return fail("Не удалось прочитать сообщение");
  }

  const conversation = await ownConversation(input.conversationId, result.context);
  if (!conversation) return fail("Вы не участник этой беседы");

  let replyToId: string | null = null;
  if (input.replyToId !== undefined) {
    if (!isId(input.replyToId)) return fail("Сообщение для ответа не найдено");
    const [reply] = await db
      .select({ id: schema.messages.id })
      .from(schema.messages)
      .where(
        and(
          eq(schema.messages.id, input.replyToId),
          eq(schema.messages.conversationId, conversation.id),
        ),
      );
    replyToId = reply?.id ?? null;
  }

  await db
    .insert(schema.messages)
    .values({
      id: input.id,
      conversationId: conversation.id,
      authorId: result.context.memberId,
      body: input.body,
      attachments,
      replyToId,
      createdAt: new Date(),
    })
    .onConflictDoNothing();

  await markRead(conversation.id, result.context.memberId);

  publish({
    type: "message",
    programSlug: input.programSlug,
    conversationId: conversation.id,
    memberIds: conversation.memberIds,
  });
  return { ok: true };
}

/**
 * Новая беседа. Группу создаёт команда программы, личный диалог — любой участник.
 * Для личного диалога возвращается уже существующая беседа, если она есть.
 */
export async function createConversationAction(input: {
  programSlug: string;
  id: string;
  kind: "group" | "direct";
  title?: string;
  topic?: string;
  emoji?: string;
  memberIds: string[];
}): Promise<{ ok: true; conversationId: string } | { ok: false; error: string }> {
  const db = getDb();
  const kind = input.kind === "direct" ? "direct" : "group";
  const result = await requireContext(input.programSlug, { staff: kind === "group" });
  if ("error" in result || !db) return fail((result as { error: string }).error);
  if (!isClientId("conv", input.id)) return fail("Не удалось создать беседу");

  const { memberId, programId } = result.context;
  const requested = Array.isArray(input.memberIds)
    ? [...new Set(input.memberIds.filter((id) => isId(id) && id !== memberId))]
    : [];

  // В беседу можно позвать только участников этой программы
  const valid = requested.length
    ? (
        await db
          .select({ memberId: schema.programMembers.memberId })
          .from(schema.programMembers)
          .where(
            and(
              eq(schema.programMembers.programId, programId),
              inArray(schema.programMembers.memberId, requested),
            ),
          )
      ).map((row) => row.memberId)
    : [];

  if (kind === "direct" && valid.length !== 1) return fail("Собеседник не найден");
  if (kind === "group" && valid.length + 1 > MAX_GROUP_MEMBERS) {
    return fail(`В группе может быть не больше ${MAX_GROUP_MEMBERS} человек`);
  }

  const title = cleanText(input.title, 120);
  if (kind === "group" && !title) return fail("Назовите группу");

  if (kind === "direct") {
    const existing = await findDirect(programId, memberId, valid[0]);
    if (existing) return { ok: true, conversationId: existing };
  }

  const participantIds = [memberId, ...valid];

  await db.transaction(async (tx) => {
    await tx.insert(schema.conversations).values({
      id: input.id,
      programId,
      kind,
      title: title ?? null,
      topic: cleanText(input.topic, 200) ?? null,
      emoji: cleanText(input.emoji, 8) ?? null,
      createdBy: memberId,
      createdAt: new Date(),
    });
    await tx
      .insert(schema.conversationMembers)
      .values(participantIds.map((id) => ({ conversationId: input.id, memberId: id })));
  });

  publish({
    type: "conversation",
    programSlug: input.programSlug,
    conversationId: input.id,
    memberIds: participantIds,
  });
  return { ok: true, conversationId: input.id };
}

async function findDirect(programId: number, a: string, b: string): Promise<string | null> {
  const db = getDb();
  if (!db) return null;
  const rows = await db.execute<{ id: string }>(sql`
    select c.id from conversations c
    where c.program_id = ${programId} and c.kind = 'direct'
      and exists (select 1 from conversation_members m where m.conversation_id = c.id and m.member_id = ${a})
      and exists (select 1 from conversation_members m where m.conversation_id = c.id and m.member_id = ${b})
    limit 1
  `);
  return rows[0]?.id ?? null;
}

async function markRead(conversationId: string, memberId: string): Promise<void> {
  const db = getDb();
  if (!db) return;
  const now = new Date();
  await db
    .insert(schema.chatReadState)
    .values({ conversationId, memberId, lastReadAt: now })
    .onConflictDoUpdate({
      target: [schema.chatReadState.conversationId, schema.chatReadState.memberId],
      set: { lastReadAt: now },
    });
}

/** Отметка «прочитано»: счётчики непрочитанных сохраняются между входами и устройствами. */
/** Удаление сообщения из чата — команда программы (администратор/модератор). */
export async function deleteMessageAction(input: {
  programSlug: string;
  conversationId: string;
  messageId: string;
}): Promise<ActionResult> {
  const db = getDb();
  const result = await requireContext(input.programSlug, { staff: true });
  if ("error" in result || !db) return fail((result as { error: string }).error);
  if (!isId(input.messageId) || !isId(input.conversationId)) return fail("Сообщение не найдено");

  const [row] = await db
    .select({ id: schema.messages.id })
    .from(schema.messages)
    .innerJoin(schema.conversations, eq(schema.conversations.id, schema.messages.conversationId))
    .where(
      and(
        eq(schema.messages.id, input.messageId),
        eq(schema.conversations.programId, result.context.programId),
      ),
    );
  if (!row) return fail("Сообщение не найдено");

  await db.delete(schema.messages).where(eq(schema.messages.id, input.messageId));

  const memberIds = await conversationMemberIds(input.conversationId);
  publish({
    type: "message",
    programSlug: input.programSlug,
    conversationId: input.conversationId,
    memberIds,
  });
  return { ok: true };
}

export async function markReadAction(input: {
  programSlug: string;
  conversationId: string;
}): Promise<ActionResult> {
  const result = await requireContext(input.programSlug);
  if ("error" in result) return fail(result.error);

  const conversation = await ownConversation(input.conversationId, result.context);
  if (!conversation) return fail("Беседа не найдена");

  await markRead(conversation.id, result.context.memberId);
  return { ok: true };
}
