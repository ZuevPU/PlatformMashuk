import { getMockPollData } from "./mock/polls";
import { hasDatabase } from "./db/client";
import { loadPollData } from "./db/queries";
import type { Member, PollData, ProgramView } from "./types";

/**
 * Опросы программы: опросы, вопросы, живые сессии и ответы.
 * Библиотека шаблонов — статичная конфигурация приложения, она остаётся в коде.
 */
export async function getPollData(
  program: ProgramView,
  members: Member[],
): Promise<PollData> {
  if (hasDatabase()) {
    const data = await loadPollData(program, members);
    if (data) return data;
  }
  return getMockPollData(program, members);
}

export type { PollData };
