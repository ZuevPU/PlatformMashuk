import { and, asc, desc, eq, inArray, sql } from "drizzle-orm";
import { getDb, schema } from "./client";
import { toMoscowIso, programSeason, programStatus } from "../dates";
import { POLL_TEMPLATES } from "../mock/polls";
import type {
  ChatData,
  ChatMessage,
  Comment,
  Conversation,
  HubData,
  Member,
  Poll,
  PollData,
  PollResponse,
  PollSession,
  Post,
  ProgramView,
  ReactionSummary,
} from "../types";

/**
 * Чтение данных из PostgreSQL.
 *
 * Функции возвращают ровно те же структуры, что и демонстрационные модули,
 * поэтому компоненты интерфейса не знают, откуда пришли данные.
 */

/* --- Реакции ------------------------------------------------------------- */

async function loadReactions(
  targetType: "post" | "comment" | "message",
  targetIds: string[],
): Promise<Map<string, ReactionSummary[]>> {
  const db = getDb();
  const map = new Map<string, ReactionSummary[]>();
  if (!db || targetIds.length === 0) return map;

  const rows = await db
    .select({
      targetId: schema.reactions.targetId,
      emoji: schema.reactions.emoji,
      total: sql<number>`count(*)::int`,
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
    list.push({ emoji: row.emoji, count: Number(row.total), mine: false });
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

  const dayRows = await db
    .select()
    .from(schema.programDays)
    .where(inArray(schema.programDays.programId, ids))
    .orderBy(asc(schema.programDays.day));

  const dayIds = dayRows.map((row) => row.id);

  const slotRows = dayIds.length
    ? await db
        .select()
        .from(schema.programSlots)
        .where(inArray(schema.programSlots.dayId, dayIds))
        .orderBy(asc(schema.programSlots.position))
    : [];

  const materialRows = await db
    .select()
    .from(schema.programMaterials)
    .where(inArray(schema.programMaterials.programId, ids));

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

export async function loadProgram(slug: string): Promise<ProgramView | undefined> {
  const [program] = await loadProgramTree(slug);
  return program;
}

async function programIdBySlug(slug: string): Promise<number | null> {
  const db = getDb();
  if (!db) return null;
  const [row] = await db
    .select({ id: schema.programs.id })
    .from(schema.programs)
    .where(eq(schema.programs.slug, slug));
  return row?.id ?? null;
}

/* --- Хаб: участники и канал --------------------------------------------- */

export async function loadHub(program: ProgramView): Promise<HubData | null> {
  const db = getDb();
  if (!db) return null;

  const programId = await programIdBySlug(program.slug);
  if (!programId) return null;

  const memberRows = await db
    .select({
      id: schema.members.id,
      name: schema.members.name,
      role: schema.members.role,
      position: schema.members.position,
      org: schema.members.org,
      city: schema.members.city,
    })
    .from(schema.programMembers)
    .innerJoin(schema.members, eq(schema.members.id, schema.programMembers.memberId))
    .where(eq(schema.programMembers.programId, programId));

  const members: Member[] = memberRows.map((row) => ({
    id: row.id,
    name: row.name,
    role: row.role,
    position: row.position ?? undefined,
    org: row.org ?? undefined,
    city: row.city ?? undefined,
  }));

  const postRows = await db
    .select()
    .from(schema.posts)
    .where(eq(schema.posts.programId, programId))
    .orderBy(desc(schema.posts.createdAt));

  const postIds = postRows.map((row) => row.id);
  const commentRows = postIds.length
    ? await db
        .select()
        .from(schema.comments)
        .where(inArray(schema.comments.postId, postIds))
        .orderBy(asc(schema.comments.createdAt))
    : [];

  const [postReactions, commentReactions] = await Promise.all([
    loadReactions("post", postIds),
    loadReactions(
      "comment",
      commentRows.map((row) => row.id),
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

  const posts: Post[] = postRows.map((row) => ({
    id: row.id,
    programSlug: program.slug,
    authorId: row.authorId,
    title: row.title ?? undefined,
    body: row.body,
    attachments: row.attachments,
    createdAt: toMoscowIso(row.createdAt),
    pinned: row.pinned,
    reactions: postReactions.get(row.id) ?? [],
    comments: commentsByPost.get(row.id) ?? [],
  }));

  return { members, posts, currentUserId: "u-p-01" };
}

/* --- Опросы ------------------------------------------------------------- */

export async function loadPollData(
  program: ProgramView,
  members: Member[],
): Promise<PollData | null> {
  const db = getDb();
  if (!db) return null;

  const programId = await programIdBySlug(program.slug);
  if (!programId) return null;

  const pollRows = await db
    .select()
    .from(schema.polls)
    .where(eq(schema.polls.programId, programId));

  if (pollRows.length === 0) {
    return { polls: [], sessions: [], templates: POLL_TEMPLATES };
  }

  const pollIds = pollRows.map((row) => row.id);

  const questionRows = await db
    .select()
    .from(schema.pollQuestions)
    .where(inArray(schema.pollQuestions.pollId, pollIds))
    .orderBy(asc(schema.pollQuestions.position));

  const sessionRows = await db
    .select()
    .from(schema.pollSessions)
    .where(inArray(schema.pollSessions.pollId, pollIds));

  const sessionIds = sessionRows.map((row) => row.id);

  const responseRows = sessionIds.length
    ? await db
        .select()
        .from(schema.pollResponses)
        .where(inArray(schema.pollResponses.sessionId, sessionIds))
        .orderBy(asc(schema.pollResponses.createdAt))
    : [];

  const polls: Poll[] = pollRows.map((row) => ({
    id: row.id,
    programSlug: program.slug,
    title: row.title,
    description: row.description ?? undefined,
    anonymous: row.anonymous,
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

  const sessions: PollSession[] = sessionRows.map((row) => ({
    id: row.id,
    pollId: row.pollId,
    programSlug: program.slug,
    code: row.code,
    status: row.status,
    currentIndex: row.currentIndex,
    accepting: row.accepting,
    showResults: row.showResults,
    startedAt: row.startedAt ? toMoscowIso(row.startedAt) : undefined,
    finishedAt: row.finishedAt ? toMoscowIso(row.finishedAt) : undefined,
    responses: responseRows
      .filter((response) => response.sessionId === row.id)
      .map<PollResponse>((response) => ({
        id: response.id,
        questionId: response.questionId,
        memberId: response.memberId ?? undefined,
        value: {
          optionIds: response.optionIds,
          text: response.text ?? undefined,
          scale: response.scale ?? undefined,
        },
        createdAt: toMoscowIso(response.createdAt),
      })),
  }));

  return { polls, sessions, templates: POLL_TEMPLATES };
}

/* --- Чаты --------------------------------------------------------------- */

export async function loadChatData(
  program: ProgramView,
  members: Member[],
): Promise<ChatData | null> {
  const db = getDb();
  if (!db) return null;

  const programId = await programIdBySlug(program.slug);
  if (!programId) return null;

  const conversationRows = await db
    .select()
    .from(schema.conversations)
    .where(eq(schema.conversations.programId, programId));

  if (conversationRows.length === 0) {
    return { conversations: [], messages: [], readState: {} };
  }

  const conversationIds = conversationRows.map((row) => row.id);

  const memberRows = await db
    .select()
    .from(schema.conversationMembers)
    .where(inArray(schema.conversationMembers.conversationId, conversationIds));

  const messageRows = await db
    .select()
    .from(schema.messages)
    .where(inArray(schema.messages.conversationId, conversationIds))
    .orderBy(asc(schema.messages.createdAt));

  const [messageReactions, readRows] = await Promise.all([
    loadReactions(
      "message",
      messageRows.map((row) => row.id),
    ),
    db
      .select()
      .from(schema.chatReadState)
      .where(inArray(schema.chatReadState.conversationId, conversationIds)),
  ]);

  const conversations: Conversation[] = conversationRows.map((row) => ({
    id: row.id,
    programSlug: program.slug,
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
