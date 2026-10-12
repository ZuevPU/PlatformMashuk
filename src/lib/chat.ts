import { getMockChatData } from "./mock/chat";
import { hasDatabase } from "./db/client";
import { loadChatData } from "./db/queries";
import type { ChatData, Member, ProgramView } from "./types";

/**
 * Чаты программы: беседы, сообщения и отметки о прочтении.
 * Из базы, если она подключена, иначе — демонстрационный набор.
 */
export async function getChatData(
  program: ProgramView,
  members: Member[],
): Promise<ChatData> {
  if (hasDatabase()) {
    const data = await loadChatData(program, members);
    if (data) return data;
  }
  return getMockChatData(program, members);
}

export type { ChatData };
