import { getMockHub } from "./mock/hub";
import { hasDatabase } from "./db/client";
import { loadHub } from "./db/queries";
import type { HubData, ProgramView } from "./types";

/**
 * Данные хаба программы: состав участников и канал.
 * Из базы, если она подключена, иначе — демонстрационный набор.
 */
export async function getHub(program: ProgramView): Promise<HubData> {
  if (hasDatabase()) {
    const data = await loadHub(program);
    if (data) return data;
  }
  return getMockHub(program);
}

export type { HubData };
