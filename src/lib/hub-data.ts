import { getViewer } from "./auth";
import {
  loadChannel,
  loadChatData,
  loadMembers,
  loadPollData,
} from "./db/queries";
import type { Viewer } from "./db/queries";
import type { ChatData, Member, MemberRole, PollData, Post } from "./types";

/**
 * Данные хаба от имени того, кто смотрит.
 *
 * Страница хаба загружает все части сразу, а при живых событиях браузер
 * подтягивает только изменившуюся часть через /api/hub/[part].
 */

export type HubPart = "channel" | "chats" | "polls" | "members";

export interface HubAccess {
  programId: number;
  programSlug: string;
  memberId: string;
  name: string;
  role: MemberRole;
  viewer: Viewer;
}

export async function getHubAccess(programSlug: string): Promise<HubAccess | null> {
  const access = await getViewer(programSlug);
  if (!access) return null;
  const { programId } = access;

  return {
    programId,
    programSlug,
    memberId: access.user.member.id,
    name: access.user.member.name,
    role: access.role,
    viewer: {
      id: access.user.member.id,
      staff: access.role === "admin" || access.role === "moderator",
    },
  };
}

export interface HubParts {
  channel: Post[];
  chats: ChatData;
  polls: PollData;
  members: Member[];
}

export function loadHubPart<P extends HubPart>(part: P, access: HubAccess): Promise<HubParts[P]> {
  const { programId, programSlug, viewer } = access;
  const loaders: { [K in HubPart]: () => Promise<HubParts[K]> } = {
    channel: () => loadChannel(programId, programSlug, viewer),
    chats: () => loadChatData(programId, programSlug, viewer),
    polls: () => loadPollData(programId, programSlug, viewer),
    members: () => loadMembers(programId),
  };
  return loaders[part]() as Promise<HubParts[P]>;
}

export async function loadHubParts(access: HubAccess): Promise<HubParts> {
  const [channel, chats, polls, members] = await Promise.all([
    loadHubPart("channel", access),
    loadHubPart("chats", access),
    loadHubPart("polls", access),
    loadHubPart("members", access),
  ]);
  return { channel, chats, polls, members };
}
