import { cache } from "react";
import { and, asc, desc, eq, inArray, or, sql } from "drizzle-orm";
import { getDb, schema } from "./client";
import { toMoscowIso, programSeason, programStatus } from "../dates";
import { POLL_TEMPLATES } from "../poll-templates";
import { respondentKey } from "../respondent";
import type {
  ChatData,
  ChatMessage,
  Comment,
  Conversation,
  Member,
  Poll,
  PollData,
  PollResponse,
  PollSession,
  Post,
  ProgramView,
  ReactionSummary,
  SessionStatus,
} from "../types";

/**
 * Чтение данных из PostgreSQL.
 *
 * Данные хаба всегда читаются от имени конкретного человека (viewer):
 * он получает только свои беседы, видит свои реакции и знает, на какие
 * вопросы опроса уже ответил. Ничего лишнего в браузер не уходит.
 */

export interface Viewer {
  id: string;
  /** Команда программы: администратор или модератор */
  staff: boolean;
}

/* --- Реакции ------------------------------------------------------------- */

async function loadReactions(
  targetType: "post" | "comment" | "message",
  targetIds: string[],
  viewerId: string,
): Promise<Map<string, ReactionSummary[]>> {
  const db = getDb();
  const map = new Map<string, ReactionSummary[]>();
  if (!db || targetIds.length === 0) return map;

  const rows = await db
    .select({
      targetId: schema.reactions.targetId,
      emoji: schema.reactions.emoji,
      total: sql<number>`count(*)::int`,
      mine: sql<boolean>`bool_or(${schema.reactions.memberId} = ${viewerId})`,
    })
    .from(schema.reactions)
    .where(
      and(
        eq(schema.reactions.targetType, targetType),
        inArray(schema.reactions.targetId, targetIds),
      ),
    )
    .groupBy(schema.reactions.targetId, schema.reactions.emoji);

  for (const row of rows) {
    const list = map.get(row.targetId) ?? [];
    list.push({ emoji: row.emoji, count: Number(row.total), mine: Boolean(row.mine) });
    map.set(row.targetId, list);
  }
  for (const list of map.values()) list.sort((a, b) => b.count - a.count);
  return map;
}

/* --- Программы ---------------------------------------------------------- */

async function loadProgramTree(slug?: string): Promise<ProgramView[]> {
  const db = getDb();
  if (!db) return [];

  const programRows = slug
    ? await db.select().from(schema.programs).where(eq(schema.programs.slug, slug))
    : await db.select().from(schema.programs).orderBy(desc(schema.programs.startDate));

  if (programRows.length === 0) return [];
  const ids = programRows.map((row) => row.id);

  const [dayRows, materialRows] = await Promise.all([
    db
      .select()
      .from(schema.programDays)
      .where(inArray(schema.programDays.programId, ids))
      .orderBy(asc(schema.programDays.day)),
    db
      .select()
      .from(schema.programMaterials)
      .where(inArray(schema.programMaterials.programId, ids))
      .orderBy(asc(schema.programMaterials.day), asc(schema.programMaterials.id)),
  ]);

  const dayIds = dayRows.map((row) => row.id);
  const slotRows = dayIds.length
    ? await db
        .select()
        .from(schema.programSlots)
        .where(inArray(schema.programSlots.dayId, dayIds))
        .orderBy(asc(schema.programSlots.position))
    : [];

  return programRows.map((row) => {
    const days = dayRows
      .filter((day) => day.programId === row.id)
      .map((day) => ({
        day: day.day,
        date: day.date,
        theme: day.theme,
        slots: slotRows
          .filter((slot) => slot.dayId === day.id)
          .map((slot) => ({
            time: slot.time,
            title: slot.title,
            description: slot.description ?? undefined,
            speakers: slot.speakers,
            tag: slot.tag ?? undefined,
          })),
      }));

    const program = {
      slug: row.slug,
      title: row.title,
      subtitle: row.subtitle,
      stream: row.stream ?? undefined,
      direction: row.direction,
      startDate: row.startDate,
      endDate: row.endDate,
      location: row.location,
      season: row.season ?? undefined,
      participants: row.participants ?? undefined,
      format: row.format ?? undefined,
      hero: { lead: row.heroLead, facts: row.heroFacts },
      about: {
        lead: row.aboutLead,
        quote: row.quoteText ? { text: row.quoteText, caption: row.quoteCaption ?? undefined } : undefined,
        blocks: row.aboutBlocks,
      },
      results: row.results,
      days,
      materials: materialRows
        .filter((material) => material.programId === row.id)
        .map((material) => ({
          id: material.code,
          day: material.day,
          kind: material.kind,
          title: material.title,
          description: material.description ?? undefined,
          speakers: material.speakers,
          links: material.links,
        })),
      note: row.note ?? undefined,
      landing: row.landingUrl
        ? { url: row.landingUrl, code: row.landingCode ?? undefined }
        : undefined,
      driveFolder: row.driveFolder ?? undefined,
      demo: row.isDemo,
      hasBuild: Boolean(row.buildUploadedAt),
    };

    return {
      ...program,
      season: programSeason(program),
      status: programStatus(program),
    } satisfies ProgramView;
  });
}

export async function loadPrograms(): Promise<ProgramView[]> {
  return loadProgramTree();
}

export const loadProgram = cache(async (slug: string): Promise<ProgramView | undefined> => {
  const [program] = await loadProgramTree(slug);
  return program;
});

export const programIdBySlug = cache(async (slug: string): Promise<number | null> => {
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .select({ id: schema.programs.id })
    .from(schema.programs)
    .where(eq(schema.programs.slug, slug));
  return row?.id ?? null;
});

/** Программа и текущая версия её сборки (момент загрузки в мс); null — сборки нет. */
export const buildBySlug = cache(
  async (slug: string): Promise<{ programId: number; version: number | null } | null> => {
    const db = getDb();
    if (!db) return null;
    const [row] = await db
      .select({ id: schema.programs.id, uploadedAt: schema.programs.buildUploadedAt })
      .from(schema.programs)
      .where(eq(schema.programs.slug, slug));
    return row ? { programId: row.id, version: row.uploadedAt?.getTime() ?? null } : null;
  },
);

/* --- Состав программы ---------------------------------------------------- */

export async function loadMembers(programId: number): Promise<Member[]> {
  const db = getDb();
  if (!db) return [];

  const rows = await db
    .select({
      id: schema.members.id,
      name: schema.members.name,
      role: schema.programMembers.role,
      position: schema.members.position,
      org: schema.members.org,
      city: schema.members.city,
    })
    .from(schema.programMembers)
    .innerJoin(schema.members, eq(schema.members.id, schema.programMembers.memberId))
    .where(eq(schema.programMembers.programId, programId))
    .orderBy(asc(schema.members.name));

  return rows.map((row) => ({
    id: row.id,
    name: row.name,
    role: row.role,
    position: row.position ?? undefined,
    org: row.org ?? undefined,
    city: row.city ?? undefined,
  }));
}

/* --- Канал --------------------------------------------------------------- */

export async function loadChannel(
  programId: number,
  programSlug: string,
  viewer: Viewer,
): Promise<Post[]> {
  const db = getDb();
  if (!db) return [];

  const postRows = await db
    .select()
    .from(schema.posts)
    .where(eq(schema.posts.programId, programId))
    .orderBy(desc(schema.posts.pinned), desc(schema.posts.createdAt));

  const postIds = postRows.map((row) => row.id);
  const commentRows = postIds.length
    ? await db
        .select()
        .from(schema.comments)
        .where(inArray(schema.comments.postId, postIds))
        .orderBy(asc(schema.comments.createdAt))
    : [];

  const [postReactions, commentReactions] = await Promise.all([
    loadReactions("post", postIds, viewer.id),
    loadReactions(
      "comment",
      commentRows.map((row) => row.id),
      viewer.id,
    ),
  ]);

  const commentsByPost = new Map<string, Comment[]>();
  const commentIndex = new Map<string, Comment>();

  for (const row of commentRows) {
    const comment: Comment = {
      id: row.id,
      authorId: row.authorId,
      body: row.body,
      createdAt: toMoscowIso(row.createdAt),
      reactions: commentReactions.get(row.id) ?? [],
      replies: [],
    };
    commentIndex.set(row.id, comment);
    if (!row.parentId) {
      const list = commentsByPost.get(row.postId) ?? [];
      list.push(comment);
      commentsByPost.set(row.postId, list);
    }
  }
  for (const row of commentRows) {
    if (!row.parentId) continue;
    const parent = commentIndex.get(row.parentId);
    const child = commentIndex.get(row.id);
    if (parent && child) parent.replies.push(child);
  }

  return postRows.map((row) => ({
    id: row.id,
    programSlug,
    authorId: row.authorId,
    title: row.title ?? undefined,
    body: row.body,
    attachments: row.attachments,
    createdAt: toMoscowIso(row.createdAt),
    pinned: row.pinned,
    reactions: postReactions.get(row.id) ?? [],
    comments: commentsByPost.get(row.id) ?? [],
  }));
}

/* --- Опросы ------------------------------------------------------------- */

/**
 * Опросы программы. С onlySessionId — только одна сессия и её опрос:
 * так во время живого опроса браузер подтягивает свежие ответы, не читая
 * заново все прошлые опросы программы.
 */
export async function loadPollData(
  programId: number,
  programSlug: string,
  viewer: Viewer,
  onlySessionId?: string,
): Promise<PollData> {
  const db = getDb();
  if (!db) return { polls: [], sessions: [], templates: POLL_TEMPLATES };

  const pollRows = onlySessionId
    ? await db
        .select({ poll: schema.polls })
        .from(schema.polls)
        .innerJoin(schema.pollSessions, eq(schema.pollSessions.pollId, schema.polls.id))
        .where(and(eq(schema.polls.programId, programId), eq(schema.pollSessions.id, onlySessionId)))
        .then((rows) => rows.map((row) => row.poll))
    : await db
        .select()
        .from(schema.polls)
        .where(eq(schema.polls.programId, programId))
        .orderBy(desc(schema.polls.createdAt));

  if (pollRows.length === 0) {
    return { polls: [], sessions: [], templates: POLL_TEMPLATES };
  }

  const pollIds = pollRows.map((row) => row.id);
  const [questionRows, sessionRows] = await Promise.all([
    db
      .select()
      .from(schema.pollQuestions)
      .where(inArray(schema.pollQuestions.pollId, pollIds))
      .orderBy(asc(schema.pollQuestions.position)),
    db
      .select()
      .from(schema.pollSessions)
      .where(
        onlySessionId
          ? eq(schema.pollSessions.id, onlySessionId)
          : inArray(schema.pollSessions.pollId, pollIds),
      ),
  ]);

  // Участник не видит черновики: опрос появляется у него, когда ведущий его запустил
  const visibleSessions = viewer.staff
    ? sessionRows
    : sessionRows.filter((row) => row.status !== "draft");
  const sessionIds = visibleSessions.map((row) => row.id);

  const responseRows = sessionIds.length
    ? await db
        .select({
          id: schema.pollResponses.id,
          sessionId: schema.pollResponses.sessionId,
          questionId: schema.pollResponses.questionId,
          memberId: schema.pollResponses.memberId,
          respondentKey: schema.pollResponses.respondentKey,
          optionIds: schema.pollResponses.optionIds,
          text: schema.pollResponses.text,
          scale: schema.pollResponses.scale,
          hidden: schema.pollResponses.hidden,
          answered: schema.pollResponses.answered,
          createdAt: schema.pollResponses.createdAt,
        })
        .from(schema.pollResponses)
        .where(inArray(schema.pollResponses.sessionId, sessionIds))
        .orderBy(asc(schema.pollResponses.createdAt))
    : [];

  const visiblePollIds = new Set(visibleSessions.map((row) => row.pollId));

  const polls: Poll[] = pollRows
    .filter((row) => viewer.staff || visiblePollIds.has(row.id))
    .map((row) => ({
      id: row.id,
      programSlug,
      title: row.title,
      description: row.description ?? undefined,
      anonymous: row.anonymous,
      teamCount: row.teamCount,
      createdAt: toMoscowIso(row.createdAt),
      source: row.source,
      templateKey: row.templateKey ?? undefined,
      questions: questionRows
        .filter((question) => question.pollId === row.id)
        .map((question) => ({
          // id вопроса — тот же, что в базе: клиент отправляет его обратно без преобразований
          id: question.id,
          kind: question.kind,
          title: question.title,
          hint: question.hint ?? undefined,
          options: question.options,
          scaleLabels: question.scaleLabels ?? undefined,
          visual: question.visual ?? undefined,
          timeLimit: question.timeLimit,
          points: question.points,
        })),
    }));

  // Голоса за вопросы зала (Q&A)
  const voteRows = responseRows.length
    ? await db
        .select({ responseId: schema.qaVotes.responseId, memberId: schema.qaVotes.memberId })
        .from(schema.qaVotes)
        .where(inArray(schema.qaVotes.responseId, responseRows.map((row) => row.id)))
    : [];
  const voteCount = new Map<string, number>();
  const votedByMe = new Set<string>();
  for (const vote of voteRows) {
    voteCount.set(vote.responseId, (voteCount.get(vote.responseId) ?? 0) + 1);
    if (vote.memberId === viewer.id) votedByMe.add(vote.responseId);
  }

  const sessions: PollSession[] = visibleSessions.map((row) => {
    const mineKey = respondentKey(viewer.id, row.id);
    return {
      id: row.id,
      pollId: row.pollId,
      programSlug,
      code: row.code,
      status: row.status,
      currentIndex: row.currentIndex,
      accepting: row.accepting,
      showResults: row.showResults,
      startedAt: row.startedAt ? toMoscowIso(row.startedAt) : undefined,
      finishedAt: row.finishedAt ? toMoscowIso(row.finishedAt) : undefined,
      responses: responseRows
        .filter((response) => response.sessionId === row.id)
        // Скрытые модератором вопросы Q&A участникам не отдаём
        .filter((response) => viewer.staff || !response.hidden)
        .map<PollResponse>((response) => ({
          id: response.id,
          questionId: response.questionId,
          memberId: response.memberId ?? undefined,
          mine: response.respondentKey === mineKey || response.memberId === viewer.id,
          hidden: response.hidden,
          answered: response.answered,
          votes: voteCount.get(response.id) ?? 0,
          voted: votedByMe.has(response.id),
          value: {
            optionIds: response.optionIds,
            text: response.text ?? undefined,
            scale: response.scale ?? undefined,
          },
          createdAt: toMoscowIso(response.createdAt),
        })),
    };
  });

  return { polls, sessions, templates: POLL_TEMPLATES };
}

/* --- Вход в опрос по коду или ссылке ----------------------------------- */

export interface PollJoinTarget {
  sessionId: string;
  programSlug: string;
  status: SessionStatus;
}

/**
 * Сессия опроса по коду (четыре цифры) или по её id.
 *
 * Так участник попадает в опрос по ссылке /poll/<код> или отсканировав QR.
 * Если под код подходит несколько сессий, берётся идущая сейчас, затем
 * черновик — завершённые в конце.
 */
export async function findPollSession(codeOrId: string): Promise<PollJoinTarget | null> {
  const db = getDb();
  if (!db || !/^[\w-]{1,80}$/.test(codeOrId)) return null;

  const rows = await db
    .select({
      sessionId: schema.pollSessions.id,
      status: schema.pollSessions.status,
      startedAt: schema.pollSessions.startedAt,
      programSlug: schema.programs.slug,
    })
    .from(schema.pollSessions)
    .innerJoin(schema.polls, eq(schema.polls.id, schema.pollSessions.pollId))
    .innerJoin(schema.programs, eq(schema.programs.id, schema.polls.programId))
    .where(or(eq(schema.pollSessions.id, codeOrId), eq(schema.pollSessions.code, codeOrId)));

  if (rows.length === 0) return null;

  const rank = (status: SessionStatus) => (status === "live" ? 3 : status === "draft" ? 2 : 1);
  rows.sort(
    (a, b) =>
      rank(b.status) - rank(a.status) ||
      (b.startedAt?.getTime() ?? 0) - (a.startedAt?.getTime() ?? 0),
  );

  const best = rows[0];
  return { sessionId: best.sessionId, programSlug: best.programSlug, status: best.status };
}

/* --- Чаты --------------------------------------------------------------- */

/** Только беседы, где состоит человек: чужие личные диалоги в браузер не попадают. */
export async function loadChatData(
  programId: number,
  programSlug: string,
  viewer: Viewer,
): Promise<ChatData> {
  const db = getDb();
  const empty: ChatData = { conversations: [], messages: [], readState: {} };
  if (!db) return empty;

  const conversationRows = await db
    .select({
      id: schema.conversations.id,
      kind: schema.conversations.kind,
      title: schema.conversations.title,
      topic: schema.conversations.topic,
      emoji: schema.conversations.emoji,
      createdBy: schema.conversations.createdBy,
      createdAt: schema.conversations.createdAt,
    })
    .from(schema.conversations)
    .innerJoin(
      schema.conversationMembers,
      and(
        eq(schema.conversationMembers.conversationId, schema.conversations.id),
        eq(schema.conversationMembers.memberId, viewer.id),
      ),
    )
    .where(eq(schema.conversations.programId, programId));

  if (conversationRows.length === 0) return empty;

  const conversationIds = conversationRows.map((row) => row.id);

  const [memberRows, messageRows, readRows] = await Promise.all([
    db
      .select()
      .from(schema.conversationMembers)
      .where(inArray(schema.conversationMembers.conversationId, conversationIds)),
    db
      .select()
      .from(schema.messages)
      .where(inArray(schema.messages.conversationId, conversationIds))
      .orderBy(asc(schema.messages.createdAt)),
    db
      .select()
      .from(schema.chatReadState)
      .where(
        and(
          inArray(schema.chatReadState.conversationId, conversationIds),
          eq(schema.chatReadState.memberId, viewer.id),
        ),
      ),
  ]);

  const messageReactions = await loadReactions(
    "message",
    messageRows.map((row) => row.id),
    viewer.id,
  );

  const conversations: Conversation[] = conversationRows.map((row) => ({
    id: row.id,
    programSlug,
    kind: row.kind,
    title: row.title ?? undefined,
    topic: row.topic ?? undefined,
    emoji: row.emoji ?? undefined,
    createdBy: row.createdBy,
    createdAt: toMoscowIso(row.createdAt),
    memberIds: memberRows
      .filter((member) => member.conversationId === row.id)
      .map((member) => member.memberId),
  }));

  const messages: ChatMessage[] = messageRows.map((row) => ({
    id: row.id,
    conversationId: row.conversationId,
    authorId: row.authorId,
    body: row.body,
    attachments: row.attachments,
    createdAt: toMoscowIso(row.createdAt),
    reactions: messageReactions.get(row.id) ?? [],
    replyToId: row.replyToId ?? undefined,
  }));

  const readState: Record<string, string> = {};
  for (const row of readRows) {
    readState[`${row.memberId}:${row.conversationId}`] = toMoscowIso(row.lastReadAt);
  }

  return { conversations, messages, readState };
}
