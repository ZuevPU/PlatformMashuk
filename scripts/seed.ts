/**
 * Наполнение базы: программа «Образование на высоте» с демонстрационным
 * каналом, чатами и опросами, администратор Центра и пароль программы.
 *
 * Запуск:
 *   DATABASE_URL=postgres://... npm run db:seed
 *
 * Пароли берутся из SEED_ADMIN_PASSWORD, SEED_PROGRAM_PASSWORD и
 * SEED_DEMO_PASSWORD. Если их нет — генерируются и сохраняются в
 * storage/seed-credentials.txt (файл не попадает в git).
 *
 * ВНИМАНИЕ: сид очищает все таблицы. На рабочей базе не запускать.
 */

import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { drizzle } from "drizzle-orm/postgres-js";
import postgres from "postgres";
import * as schema from "../src/lib/db/schema";
import { PROGRAMS } from "../src/lib/mock/programs";
import { getMockHub } from "../src/lib/mock/hub";
import { getMockPollData } from "../src/lib/mock/polls";
import { getMockChatData } from "../src/lib/mock/chat";
import { programSeason, programStatus } from "../src/lib/dates";
import { generatePassword, hashPassword } from "../src/lib/password";
import { respondentKey } from "../src/lib/respondent";
import type { Member, Program, ReactionSummary } from "../src/lib/types";

const url =
  process.env.DATABASE_URL ?? "postgres://postgres:postgres@127.0.0.1:5432/mashuk_platform";

const client = postgres(url, { max: 1, prepare: false, onnotice: () => {} });
const db = drizzle(client, { schema });

type ProgramView = Program & {
  season: ReturnType<typeof programSeason>;
  status: ReturnType<typeof programStatus>;
};

/** Пишем большими порциями, но не упираемся в лимит параметров Postgres. */
const CHUNK = 400;

const ADMIN_LOGIN = "admin@mashuk.local";

function chunked<T>(rows: T[], size = CHUNK): T[][] {
  const result: T[][] = [];
  for (let index = 0; index < rows.length; index += size) {
    result.push(rows.slice(index, index + size));
  }
  return result;
}

function log(message: string) {
  process.stderr.write(`${message}\n`);
}

async function insertAll<T extends Record<string, unknown>>(
  table: Parameters<typeof db.insert>[0],
  rows: T[],
) {
  for (const part of chunked(rows)) {
    if (part.length === 0) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    await db.insert(table).values(part as any);
  }
}

const views: ProgramView[] = PROGRAMS.map((program) => ({
  ...program,
  season: programSeason(program),
  status: programStatus(program),
}));

/** Реакции в демо-данных хранятся сводкой — разворачиваем их по участникам. */
function expandReactions(
  summaries: ReactionSummary[],
  targetType: "post" | "comment" | "message",
  targetId: string,
  pool: Member[],
) {
  const rows: {
    targetType: "post" | "comment" | "message";
    targetId: string;
    memberId: string;
    emoji: string;
    createdAt: Date;
  }[] = [];

  for (const summary of summaries) {
    for (const member of pool.slice(0, Math.min(summary.count, pool.length))) {
      rows.push({
        targetType,
        targetId,
        memberId: member.id,
        emoji: summary.emoji,
        createdAt: new Date(),
      });
    }
  }

  return rows;
}

async function main() {
  // Сид очищает все таблицы — на рабочем сервере только по явному согласию
  if (process.env.NODE_ENV === "production" && process.env.SEED_FORCE !== "1") {
    log("Отказ: NODE_ENV=production. Сид удалит все данные. Если это стенд — SEED_FORCE=1.");
    process.exitCode = 1;
    await client.end();
    return;
  }

  log("1/9  Читаю демонстрационные данные…");

  const hubs = new Map(views.map((view) => [view.slug, getMockHub(view)]));
  const memberMap = new Map<string, Member>();
  for (const hub of hubs.values()) {
    for (const member of hub.members) memberMap.set(member.id, member);
  }
  const members = [...memberMap.values()];
  const participantPool = members.filter((member) => member.role === "participant");
  log(`     программ: ${views.length}, участников: ${members.length}`);

  log("2/9  Очищаю таблицы…");
  await client.unsafe(`
    TRUNCATE TABLE
      chat_read_state, messages, conversation_members, conversations,
      poll_responses, poll_sessions, poll_questions, polls,
      comments, posts, reactions, program_members, auth_sessions, login_attempts, members,
      program_materials, program_slots, program_days, programs
    RESTART IDENTITY CASCADE
  `);

  log("3/9  Пишу участников и программы…");
  const credentials = {
    admin: process.env.SEED_ADMIN_PASSWORD || generatePassword(),
    program: process.env.SEED_PROGRAM_PASSWORD || generatePassword(),
    demo: process.env.SEED_DEMO_PASSWORD || generatePassword(),
  };
  const [adminHash, demoHash, programHash] = await Promise.all([
    hashPassword(credentials.admin),
    hashPassword(credentials.demo),
    hashPassword(credentials.program),
  ]);

  // Администратор демо-состава — администратор Центра; остальные входят общим демо-паролем
  await insertAll(schema.members, members.map((member) => ({
    id: member.id,
    name: member.name,
    role: member.role === "admin" ? "admin" : "participant",
    position: member.position ?? null,
    org: member.org ?? null,
    city: member.city ?? null,
    contact: member.role === "admin" ? ADMIN_LOGIN : `${member.id}@demo.mashuk`,
    passwordHash: member.role === "admin" ? adminHash : demoHash,
  })));

  const insertedPrograms = await db
    .insert(schema.programs)
    .values(
      views.map((view) => ({
        slug: view.slug,
        title: view.title,
        subtitle: view.subtitle,
        stream: view.stream ?? null,
        direction: view.direction,
        startDate: view.startDate,
        endDate: view.endDate,
        location: view.location,
        season: view.season,
        participants: view.participants ?? null,
        format: view.format ?? null,
        heroLead: view.hero.lead,
        heroFacts: view.hero.facts,
        aboutLead: view.about.lead,
        aboutBlocks: view.about.blocks,
        quoteText: view.about.quote?.text ?? null,
        quoteCaption: view.about.quote?.caption ?? null,
        results: view.results,
        note: view.note ?? null,
        landingUrl: view.landing?.url ?? null,
        landingCode: view.landing?.code ?? null,
        driveFolder: view.driveFolder ?? null,
        isDemo: Boolean(view.demo),
        accessPasswordHash: programHash,
      })),
    )
    .returning({ id: schema.programs.id, slug: schema.programs.slug });

  const programIds = new Map(insertedPrograms.map((row) => [row.slug, row.id]));

  log("4/9  Пишу состав, дни, блоки и материалы…");
  const programMemberRows = views.flatMap((view) =>
    hubs.get(view.slug)!.members.map((member) => ({
      programId: programIds.get(view.slug)!,
      memberId: member.id,
      role: member.role,
    })),
  );
  await insertAll(schema.programMembers, programMemberRows);

  const dayRows = views.flatMap((view) =>
    view.days.map((day) => ({
      programId: programIds.get(view.slug)!,
      day: day.day,
      date: day.date,
      theme: day.theme,
    })),
  );
  const insertedDays = await db
    .insert(schema.programDays)
    .values(dayRows)
    .returning({ id: schema.programDays.id, programId: schema.programDays.programId, day: schema.programDays.day });

  const dayIds = new Map(insertedDays.map((row) => [`${row.programId}:${row.day}`, row.id]));

  const slotRows = views.flatMap((view) =>
    view.days.flatMap((day) =>
      day.slots.map((slot, index) => ({
        dayId: dayIds.get(`${programIds.get(view.slug)!}:${day.day}`)!,
        position: index,
        time: slot.time,
        title: slot.title,
        description: slot.description ?? null,
        speakers: slot.speakers ?? [],
        tag: slot.tag ?? null,
      })),
    ),
  );
  await insertAll(schema.programSlots, slotRows);

  const materialRows = views.flatMap((view) =>
    view.materials.map((material) => ({
      programId: programIds.get(view.slug)!,
      code: material.id,
      day: material.day,
      kind: material.kind,
      title: material.title,
      description: material.description ?? null,
      speakers: material.speakers ?? [],
      links: material.links,
    })),
  );
  await insertAll(schema.programMaterials, materialRows);

  log("5/9  Пишу канал: посты, комментарии, реакции…");
  const postRows: (typeof schema.posts.$inferInsert)[] = [];
  const commentRows: (typeof schema.comments.$inferInsert)[] = [];
  const reactionRows: ReturnType<typeof expandReactions> = [];

  for (const view of views) {
    const programId = programIds.get(view.slug)!;
    for (const post of hubs.get(view.slug)!.posts) {
      postRows.push({
        id: post.id,
        programId,
        authorId: post.authorId,
        title: post.title ?? null,
        body: post.body,
        attachments: post.attachments,
        pinned: post.pinned,
        createdAt: new Date(post.createdAt),
      });
      reactionRows.push(...expandReactions(post.reactions, "post", post.id, participantPool));

      const walk = (comments: typeof post.comments, parentId: string | null) => {
        for (const comment of comments) {
          commentRows.push({
            id: comment.id,
            postId: post.id,
            parentId,
            authorId: comment.authorId,
            body: comment.body,
            createdAt: new Date(comment.createdAt),
          });
          reactionRows.push(
            ...expandReactions(comment.reactions, "comment", comment.id, participantPool),
          );
          if (comment.replies.length > 0) walk(comment.replies, comment.id);
        }
      };
      walk(post.comments, null);
    }
  }

  await insertAll(schema.posts, postRows);
  await insertAll(schema.comments, commentRows);
  log(`     постов: ${postRows.length}, комментариев: ${commentRows.length}`);

  log("6/9  Пишу опросы…");
  const pollRows: (typeof schema.polls.$inferInsert)[] = [];
  const questionRows: (typeof schema.pollQuestions.$inferInsert)[] = [];
  const sessionRows: (typeof schema.pollSessions.$inferInsert)[] = [];
  const responseRows: (typeof schema.pollResponses.$inferInsert)[] = [];

  // Вопросы шаблонов общие для нескольких программ, поэтому id вопроса
  // и id ответа получают пространство имён из опроса и сессии.
  const questionKey = (pollId: string, questionId: string) => `${pollId}:${questionId}`;

  for (const view of views) {
    const programId = programIds.get(view.slug)!;
    const pollData = getMockPollData(view, hubs.get(view.slug)!.members);

    for (const poll of pollData.polls) {
      pollRows.push({
        id: poll.id,
        programId,
        title: poll.title,
        description: poll.description ?? null,
        anonymous: poll.anonymous,
        source: poll.source,
        templateKey: poll.templateKey ?? null,
        createdAt: new Date(poll.createdAt),
      });

      poll.questions.forEach((question, index) => {
        questionRows.push({
          id: `${poll.id}--${question.id}`,
          pollId: poll.id,
          position: index,
          kind: question.kind,
          title: question.title,
          hint: question.hint ?? null,
          options: question.options,
          scaleLabels: question.scaleLabels ?? null,
          visual: question.visual ?? null,
          timeLimit: question.timeLimit,
          points: question.points,
        });
      });
    }

    for (const session of pollData.sessions) {
      sessionRows.push({
        id: session.id,
        pollId: session.pollId,
        code: session.code,
        status: session.status,
        currentIndex: session.currentIndex,
        accepting: session.accepting,
        showResults: session.showResults,
        startedAt: session.startedAt ? new Date(session.startedAt) : null,
        finishedAt: session.finishedAt ? new Date(session.finishedAt) : null,
      });

      for (const response of session.responses) {
        responseRows.push({
          id: `${session.id}--${response.id}`,
          sessionId: session.id,
          questionId: `${session.pollId}--${response.questionId}`,
          memberId: response.memberId ?? null,
          respondentKey: response.memberId ? respondentKey(response.memberId, session.id) : null,
          optionIds: response.value.optionIds,
          text: response.value.text ?? null,
          scale: response.value.scale ?? null,
          createdAt: new Date(response.createdAt),
        });
      }
    }
  }

  await insertAll(schema.polls, pollRows);
  await insertAll(schema.pollQuestions, questionRows);
  await insertAll(schema.pollSessions, sessionRows);
  await insertAll(schema.pollResponses, responseRows);
  log(
    `     опросов: ${pollRows.length}, вопросов: ${questionRows.length}, сессий: ${sessionRows.length}, ответов: ${responseRows.length}`,
  );

  log("7/9  Пишу чаты…");
  const conversationRows: (typeof schema.conversations.$inferInsert)[] = [];
  const conversationMemberRows: (typeof schema.conversationMembers.$inferInsert)[] = [];
  const messageRows: (typeof schema.messages.$inferInsert)[] = [];
  const readRows: (typeof schema.chatReadState.$inferInsert)[] = [];
  const messageReactions: ReturnType<typeof expandReactions> = [];

  for (const view of views) {
    const programId = programIds.get(view.slug)!;
    const chat = getMockChatData(view);
    const conversationIds = new Set(chat.conversations.map((item) => item.id));

    for (const conversation of chat.conversations) {
      conversationRows.push({
        id: conversation.id,
        programId,
        kind: conversation.kind,
        title: conversation.title ?? null,
        topic: conversation.topic ?? null,
        emoji: conversation.emoji ?? null,
        createdBy: conversation.createdBy,
        createdAt: new Date(conversation.createdAt),
      });

      for (const memberId of conversation.memberIds) {
        conversationMemberRows.push({ conversationId: conversation.id, memberId });
      }
    }

    // Общий чат программы: весь состав, новые участники попадают туда автоматически
    const generalId = `conv-general-${programId}`;
    const programMembers = hubs.get(view.slug)!.members;
    conversationRows.push({
      id: generalId,
      programId,
      kind: "group",
      title: "Общий чат программы",
      topic: "Все участники программы",
      emoji: "💬",
      autoJoin: true,
      createdBy: programMembers.find((member) => member.role === "admin")?.id ?? programMembers[0].id,
      createdAt: new Date(`${view.startDate}T09:00:00+03:00`),
    });
    for (const member of programMembers) {
      conversationMemberRows.push({ conversationId: generalId, memberId: member.id });
    }

    for (const message of chat.messages) {
      if (!conversationIds.has(message.conversationId)) continue;
      messageRows.push({
        id: message.id,
        conversationId: message.conversationId,
        authorId: message.authorId,
        body: message.body,
        attachments: message.attachments,
        replyToId: message.replyToId ?? null,
        createdAt: new Date(message.createdAt),
      });
      messageReactions.push(
        ...expandReactions(message.reactions, "message", message.id, participantPool),
      );
    }

    for (const [key, value] of Object.entries(chat.readState)) {
      const [memberId, ...rest] = key.split(":");
      const conversationId = rest.join(":");
      if (!conversationIds.has(conversationId)) continue;
      readRows.push({ conversationId, memberId, lastReadAt: new Date(value) });
    }
  }

  await insertAll(schema.conversations, conversationRows);
  await insertAll(schema.conversationMembers, conversationMemberRows);
  await insertAll(schema.messages, messageRows);
  await insertAll(schema.chatReadState, readRows);
  log(
    `     бесед: ${conversationRows.length}, сообщений: ${messageRows.length}, отметок о прочтении: ${readRows.length}`,
  );

  log("8/9  Пишу реакции…");
  await insertAll(schema.reactions, [...reactionRows, ...messageReactions]);
  log(`     реакций: ${reactionRows.length + messageReactions.length}`);

  log("9/9  Сохраняю пароли для входа…");
  const file = path.join(process.cwd(), "storage", "seed-credentials.txt");
  await mkdir(path.dirname(file), { recursive: true });
  await writeFile(
    file,
    [
      "Тестовые входы после seed (файл не попадает в git)",
      "",
      `Администратор Центра: ${ADMIN_LOGIN} / ${credentials.admin}  →  /join, затем /admin`,
      `Пароль программы «${views[0].title}»: ${credentials.program}  →  /programs/${views[0].slug}/enter`,
      `Демо-участники: u-p-01@demo.mashuk … / ${credentials.demo}  (модераторы: u-mod-1@demo.mashuk)`,
      "",
    ].join("\n"),
    "utf8",
  );
  log(`     логины и пароли: ${path.relative(process.cwd(), file)}`);

  await client.end();
  log("\nГотово: база наполнена демонстрационными данными.");
}

main().catch(async (error) => {
  log(`\nНе удалось наполнить базу: ${error instanceof Error ? error.message : String(error)}`);
  await client.end({ timeout: 1 }).catch(() => {});
  process.exitCode = 1;
});
