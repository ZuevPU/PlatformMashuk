import { randomUUID } from "node:crypto";
import { and, eq } from "drizzle-orm";
import { getDb, schema } from "./db/client";
import { publish } from "./events";

/**
 * Общий чат программы: в нём все участники. Человек попадает туда
 * автоматически, как только входит в программу.
 */

export async function joinGeneralChats(programId: number, memberId: string, programSlug?: string) {
  const db = getDb();
  if (!db) return;

  const chats = await db
    .select({ id: schema.conversations.id })
    .from(schema.conversations)
    .where(and(eq(schema.conversations.programId, programId), eq(schema.conversations.autoJoin, true)));
  if (chats.length === 0) return;

  await db
    .insert(schema.conversationMembers)
    .values(chats.map((chat) => ({ conversationId: chat.id, memberId })))
    .onConflictDoNothing();

  if (programSlug) {
    for (const chat of chats) {
      publish({ type: "conversation", programSlug, conversationId: chat.id, memberIds: [memberId] });
    }
  }
}

export async function createGeneralChat(programId: number, createdBy: string) {
  const db = getDb();
  if (!db) return;
  const id = `conv-${randomUUID()}`;
  await db.insert(schema.conversations).values({
    id,
    programId,
    kind: "group",
    title: "Общий чат программы",
    topic: "Все участники программы",
    emoji: "💬",
    autoJoin: true,
    createdBy,
    createdAt: new Date(),
  });
  await db.insert(schema.conversationMembers).values({ conversationId: id, memberId: createdBy });
}
