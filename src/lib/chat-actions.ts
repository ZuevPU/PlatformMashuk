import { uuid } from "./uid";
import type {
  ChatMessage,
  Conversation,
  Member,
  ReactionSummary,
  RichDoc,
  Attachment,
} from "./types";
import { toggleReaction } from "./hub-actions";

/* ==========================================================================
   Чаты: операции и подсчёты
   ========================================================================== */

export function readKey(memberId: string, conversationId: string): string {
  return `${memberId}:${conversationId}`;
}

/** Беседы, в которых участник состоит. */
export function visibleConversations(
  conversations: Conversation[],
  memberId: string,
): Conversation[] {
  return conversations.filter((conversation) => conversation.memberIds.includes(memberId));
}

/** Собеседник в личном диалоге. */
export function conversationPartner(
  conversation: Conversation,
  memberId: string,
): string | undefined {
  return conversation.memberIds.find((id) => id !== memberId);
}

/** Название беседы: у группы — своё, у личного диалога — имя собеседника. */
export function conversationTitle(
  conversation: Conversation,
  members: Member[],
  memberId: string,
): string {
  if (conversation.kind === "group") return conversation.title ?? "Группа";
  const partnerId = conversationPartner(conversation, memberId);
  return members.find((member) => member.id === partnerId)?.name ?? "Личный диалог";
}

export function messagesOf(messages: ChatMessage[], conversationId: string): ChatMessage[] {
  return messages
    .filter((message) => message.conversationId === conversationId)
    .sort((a, b) => a.createdAt.localeCompare(b.createdAt));
}

export function lastMessage(
  messages: ChatMessage[],
  conversationId: string,
): ChatMessage | undefined {
  const list = messagesOf(messages, conversationId);
  return list[list.length - 1];
}

/** Число непрочитанных сообщений: чужие сообщения после последнего прочитанного. */
export function unreadCount(
  messages: ChatMessage[],
  conversationId: string,
  memberId: string,
  readState: Record<string, string>,
): number {
  const lastReadAt = readState[readKey(memberId, conversationId)] ?? "";
  return messages.filter(
    (message) =>
      message.conversationId === conversationId &&
      message.authorId !== memberId &&
      message.createdAt > lastReadAt,
  ).length;
}

/** Беседы с непрочитанными — наверх, дальше по времени последнего сообщения. */
export function sortConversations(
  conversations: Conversation[],
  messages: ChatMessage[],
  memberId: string,
  readState: Record<string, string>,
): Conversation[] {
  return [...conversations].sort((a, b) => {
    const unreadA = unreadCount(messages, a.id, memberId, readState);
    const unreadB = unreadCount(messages, b.id, memberId, readState);
    if ((unreadA > 0) !== (unreadB > 0)) return unreadA > 0 ? -1 : 1;

    const lastA = lastMessage(messages, a.id)?.createdAt ?? a.createdAt;
    const lastB = lastMessage(messages, b.id)?.createdAt ?? b.createdAt;
    return lastB.localeCompare(lastA);
  });
}

export function findDirectConversation(
  conversations: Conversation[],
  firstMemberId: string,
  secondMemberId: string,
): Conversation | undefined {
  return conversations.find(
    (conversation) =>
      conversation.kind === "direct" &&
      conversation.memberIds.length === 2 &&
      conversation.memberIds.includes(firstMemberId) &&
      conversation.memberIds.includes(secondMemberId),
  );
}

export function canWrite(conversation: Conversation, memberId: string): boolean {
  return conversation.memberIds.includes(memberId);
}

/* --- Создание ------------------------------------------------------------ */

export function createConversation(input: {
  programSlug: string;
  kind: Conversation["kind"];
  title?: string;
  topic?: string;
  emoji?: string;
  memberIds: string[];
  createdBy: string;
  createdAt: string;
}): Conversation {
  return {
    id: `conv-${uuid()}`,
    programSlug: input.programSlug,
    kind: input.kind,
    title: input.title,
    topic: input.topic,
    emoji: input.emoji,
    memberIds: [...new Set(input.memberIds)],
    createdBy: input.createdBy,
    createdAt: input.createdAt,
  };
}

export function createMessage(input: {
  conversationId: string;
  authorId: string;
  body: RichDoc;
  attachments?: Attachment[];
  createdAt: string;
  replyToId?: string;
}): ChatMessage {
  return {
    id: `msg-${uuid()}`,
    conversationId: input.conversationId,
    authorId: input.authorId,
    body: input.body,
    attachments: input.attachments ?? [],
    createdAt: input.createdAt,
    reactions: [],
    replyToId: input.replyToId,
  };
}

export function addMessage(messages: ChatMessage[], message: ChatMessage): ChatMessage[] {
  return [...messages, message];
}

export function toggleMessageReaction(
  messages: ChatMessage[],
  messageId: string,
  emoji: string,
): ChatMessage[] {
  return messages.map((message) =>
    message.id === messageId
      ? { ...message, reactions: toggleReaction(message.reactions, emoji) }
      : message,
  );
}

/** Удаление сообщения (команда программы). */
export function removeMessage(messages: ChatMessage[], messageId: string): ChatMessage[] {
  return messages.filter((message) => message.id !== messageId);
}

/* --- Группировка по дням -------------------------------------------------- */

export interface MessageGroup {
  date: string;
  messages: ChatMessage[];
}

export function groupByDay(messages: ChatMessage[]): MessageGroup[] {
  const groups: MessageGroup[] = [];
  for (const message of messages) {
    const date = message.createdAt.slice(0, 10);
    const last = groups[groups.length - 1];
    if (last && last.date === date) {
      last.messages.push(message);
    } else {
      groups.push({ date, messages: [message] });
    }
  }
  return groups;
}

/** Реакции, которые стоит показать на сообщении: чужие всегда, свои — только с числом. */
export function visibleReactions(reactions: ReactionSummary[]): ReactionSummary[] {
  return reactions.filter((reaction) => reaction.count > 0);
}
