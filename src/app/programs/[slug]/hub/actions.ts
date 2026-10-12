"use server";

import { randomUUID } from "node:crypto";
import { revalidatePath } from "next/cache";
import { and, eq } from "drizzle-orm";
import { getDb } from "@/lib/db/client";
import * as schema from "@/lib/db/schema";
import { getProgramRole, getSessionUser } from "@/lib/auth";
import type { Attachment, MemberRole, RichDoc } from "@/lib/types";

/**
 * Запись в канал программы.
 *
 * Все действия выполняются на сервере: права проверяются по сессии и роли
 * в программе, автор берётся из сессии, а не из запроса. Клиент не может
 * подписаться чужим именем или опубликовать пост без прав.
 */

type ActionResult = { ok: true } | { ok: false; error: string };

interface Context {
  memberId: string;
  role: MemberRole;
  programId: number;
}

async function requireContext(
  programSlug: string,
  options: { staff?: boolean } = {},
): Promise<{ context: Context } | { error: string }> {
  const db = getDb();
  if (!db) return { error: "База данных не подключена" };

  const user = await getSessionUser();
  if (!user) return { error: "Нужно войти по приглашению" };

  const role = await getProgramRole(user.member.id, programSlug);
  if (!role) return { error: "Вы не участник этой программы" };
  if (options.staff && role === "participant") {
    return { error: "Публиковать посты может команда программы" };
  }

  const [program] = await db
    .select({ id: schema.programs.id })
    .from(schema.programs)
    .where(eq(schema.programs.slug, programSlug));

  if (!program) return { error: "Программа не найдена" };

  return { context: { memberId: user.member.id, role, programId: program.id } };
}

function refresh(programSlug: string) {
  revalidatePath(`/programs/${programSlug}/hub`);
  // Шину событий подключаем лениво: она нужна только в момент записи,
  // а модуль действий импортируется и при отрисовке страницы.
  void import("@/lib/events").then(({ publish }) =>
    publish({ type: "program-changed", programSlug }),
  );
}

export async function createPostAction(input: {
  programSlug: string;
  title?: string;
  body: RichDoc;
  attachments: Attachment[];
}): Promise<ActionResult> {
  const db = getDb();
  const result = await requireContext(input.programSlug, { staff: true });
  if ("error" in result || !db) return { ok: false, error: (result as { error: string }).error };

  await db.insert(schema.posts).values({
    id: `post-${randomUUID()}`,
    programId: result.context.programId,
    authorId: result.context.memberId,
    title: input.title ?? null,
    body: input.body,
    attachments: input.attachments,
    pinned: false,
    createdAt: new Date(),
  });

  refresh(input.programSlug);
  return { ok: true };
}

export async function addCommentAction(input: {
  programSlug: string;
  postId: string;
  parentId?: string;
  body: RichDoc;
}): Promise<ActionResult> {
  const db = getDb();
  const result = await requireContext(input.programSlug);
  if ("error" in result || !db) return { ok: false, error: (result as { error: string }).error };

  await db.insert(schema.comments).values({
    id: `comment-${randomUUID()}`,
    postId: input.postId,
    parentId: input.parentId ?? null,
    authorId: result.context.memberId,
    body: input.body,
    createdAt: new Date(),
  });

  refresh(input.programSlug);
  return { ok: true };
}

export async function togglePostReactionAction(input: {
  programSlug: string;
  postId: string;
  emoji: string;
}): Promise<ActionResult> {
  const db = getDb();
  const result = await requireContext(input.programSlug);
  if ("error" in result || !db) return { ok: false, error: (result as { error: string }).error };

  const { memberId } = result.context;
  const where = and(
    eq(schema.reactions.targetType, "post"),
    eq(schema.reactions.targetId, input.postId),
    eq(schema.reactions.memberId, memberId),
    eq(schema.reactions.emoji, input.emoji),
  );

  const existing = await db.select({ id: schema.reactions.id }).from(schema.reactions).where(where);

  if (existing.length > 0) {
    await db.delete(schema.reactions).where(where);
  } else {
    await db.insert(schema.reactions).values({
      targetType: "post",
      targetId: input.postId,
      memberId,
      emoji: input.emoji,
      createdAt: new Date(),
    });
  }

  refresh(input.programSlug);
  return { ok: true };
}

export async function toggleCommentReactionAction(input: {
  programSlug: string;
  commentId: string;
  emoji: string;
}): Promise<ActionResult> {
  const db = getDb();
  const result = await requireContext(input.programSlug);
  if ("error" in result || !db) return { ok: false, error: (result as { error: string }).error };

  const { memberId } = result.context;
  const where = and(
    eq(schema.reactions.targetType, "comment"),
    eq(schema.reactions.targetId, input.commentId),
    eq(schema.reactions.memberId, memberId),
    eq(schema.reactions.emoji, input.emoji),
  );

  const existing = await db.select({ id: schema.reactions.id }).from(schema.reactions).where(where);

  if (existing.length > 0) {
    await db.delete(schema.reactions).where(where);
  } else {
    await db.insert(schema.reactions).values({
      targetType: "comment",
      targetId: input.commentId,
      memberId,
      emoji: input.emoji,
      createdAt: new Date(),
    });
  }

  refresh(input.programSlug);
  return { ok: true };
}

export async function togglePinAction(input: {
  programSlug: string;
  postId: string;
  pinned: boolean;
}): Promise<ActionResult> {
  const db = getDb();
  const result = await requireContext(input.programSlug, { staff: true });
  if ("error" in result || !db) return { ok: false, error: (result as { error: string }).error };

  await db
    .update(schema.posts)
    .set({ pinned: input.pinned })
    .where(eq(schema.posts.id, input.postId));

  refresh(input.programSlug);
  return { ok: true };
}

/* --- Опросы ------------------------------------------------------------- */

/**
 * Ответ участника на вопрос опроса.
 *
 * Автор берётся из сессии. В анонимном опросе участник не записывается —
 * это и есть анонимность: связь с человеком не хранится.
 */
export async function submitPollResponseAction(input: {
  programSlug: string;
  sessionId: string;
  questionId: string;
  anonymous: boolean;
  value: { optionIds: string[]; text?: string; scale?: number };
}): Promise<ActionResult> {
  const db = getDb();
  const result = await requireContext(input.programSlug);
  if ("error" in result || !db) return { ok: false, error: (result as { error: string }).error };

  const { memberId } = result.context;

  // Отвечать можно только в живую сессию своей программы, которая принимает ответы
  const [session] = await db
    .select({
      id: schema.pollSessions.id,
      accepting: schema.pollSessions.accepting,
      status: schema.pollSessions.status,
    })
    .from(schema.pollSessions)
    .innerJoin(schema.polls, eq(schema.polls.id, schema.pollSessions.pollId))
    .where(
      and(
        eq(schema.pollSessions.id, input.sessionId),
        eq(schema.polls.programId, result.context.programId),
      ),
    );

  if (!session) return { ok: false, error: "Опрос не найден" };
  if (session.status !== "live" || !session.accepting) {
    return { ok: false, error: "Приём ответов закрыт" };
  }

  try {
    await db.insert(schema.pollResponses).values({
      id: `response-${randomUUID()}`,
      sessionId: input.sessionId,
      questionId: input.questionId,
      memberId: input.anonymous ? null : memberId,
      optionIds: input.value.optionIds,
      text: input.value.text ?? null,
      scale: input.value.scale ?? null,
      createdAt: new Date(),
    });
  } catch {
    return { ok: false, error: "Вопрос не найден в этом опросе" };
  }

  refresh(input.programSlug);
  return { ok: true };
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
  if ("error" in result || !db) return { ok: false, error: (result as { error: string }).error };

  const pollId = `poll-${randomUUID()}`;
  const sessionId = `session-${randomUUID()}`;
  const code = String(Math.floor(1000 + Math.random() * 9000));
  const questionIds = input.questions.map((_, index) => `${pollId}--q${index + 1}`);

  await db.insert(schema.polls).values({
    id: pollId,
    programId: result.context.programId,
    title: input.title,
    description: input.description ?? null,
    anonymous: input.anonymous,
    source: input.source,
    templateKey: input.templateKey ?? null,
    createdAt: new Date(),
  });

  if (input.questions.length > 0) {
    await db.insert(schema.pollQuestions).values(
      input.questions.map((question, index) => ({
        id: questionIds[index],
        pollId,
        position: index,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        kind: question.kind as any,
        title: question.title,
        hint: question.hint ?? null,
        options: question.options,
        scaleLabels: question.scaleLabels ?? null,
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        visual: (question.visual ?? null) as any,
        timeLimit: question.timeLimit,
        points: question.points,
      })),
    );
  }

  await db.insert(schema.pollSessions).values({
    id: sessionId,
    pollId,
    code,
    status: "draft",
    currentIndex: 0,
    accepting: false,
    showResults: false,
  });

  refresh(input.programSlug);
  return { ok: true, pollId, sessionId, code, questionIds };
}

/** Состояние живой сессии: запуск, переход по вопросам, приём ответов, завершение. */
export async function updatePollSessionAction(input: {
  programSlug: string;
  sessionId: string;
  status: "draft" | "live" | "finished";
  currentIndex: number;
  accepting: boolean;
  showResults: boolean;
}): Promise<ActionResult> {
  const db = getDb();
  const result = await requireContext(input.programSlug, { staff: true });
  if ("error" in result || !db) return { ok: false, error: (result as { error: string }).error };

  await db
    .update(schema.pollSessions)
    .set({
      status: input.status,
      currentIndex: input.currentIndex,
      accepting: input.accepting,
      showResults: input.showResults,
      ...(input.status === "live" ? { startedAt: new Date() } : {}),
      ...(input.status === "finished" ? { finishedAt: new Date() } : {}),
    })
    .where(eq(schema.pollSessions.id, input.sessionId));

  refresh(input.programSlug);
  return { ok: true };
}

/* --- Чаты --------------------------------------------------------------- */

export async function sendMessageAction(input: {
  programSlug: string;
  conversationId: string;
  body: RichDoc;
  attachments: Attachment[];
  replyToId?: string;
}): Promise<ActionResult> {
  const db = getDb();
  const result = await requireContext(input.programSlug);
  if ("error" in result || !db) return { ok: false, error: (result as { error: string }).error };

  const { memberId } = result.context;

  // Писать можно только в беседу, где участник состоит
  const membership = await db
    .select({ conversationId: schema.conversationMembers.conversationId })
    .from(schema.conversationMembers)
    .where(
      and(
        eq(schema.conversationMembers.conversationId, input.conversationId),
        eq(schema.conversationMembers.memberId, memberId),
      ),
    );

  if (membership.length === 0) return { ok: false, error: "Вы не участник этой беседы" };

  await db.insert(schema.messages).values({
    id: `msg-${randomUUID()}`,
    conversationId: input.conversationId,
    authorId: memberId,
    body: input.body,
    attachments: input.attachments,
    replyToId: input.replyToId ?? null,
    createdAt: new Date(),
  });

  refresh(input.programSlug);
  return { ok: true };
}

export async function createConversationAction(input: {
  programSlug: string;
  kind: "group" | "direct";
  title?: string;
  topic?: string;
  emoji?: string;
  memberIds: string[];
}): Promise<ActionResult & { conversationId?: string }> {
  const db = getDb();
  const result = await requireContext(input.programSlug, { staff: input.kind === "group" });
  if ("error" in result || !db) return { ok: false, error: (result as { error: string }).error };

  const { memberId, programId } = result.context;
  const conversationId = `conv-${randomUUID()}`;

  await db.insert(schema.conversations).values({
    id: conversationId,
    programId,
    kind: input.kind,
    title: input.title ?? null,
    topic: input.topic ?? null,
    emoji: input.emoji ?? null,
    createdBy: memberId,
    createdAt: new Date(),
  });

  const participantIds = [...new Set([memberId, ...input.memberIds])];
  await db.insert(schema.conversationMembers).values(
    participantIds.map((id) => ({ conversationId, memberId: id })),
  );

  refresh(input.programSlug);
  return { ok: true, conversationId };
}
