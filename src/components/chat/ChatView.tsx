"use client";

import { useEffect, useMemo, useState } from "react";
import { MessageSquarePlus, Search, Users, X } from "lucide-react";
import { NewChatDialog } from "./NewChatDialog";
import { MessageFeed } from "./MessageFeed";
import { Avatar } from "@/components/hub/Avatar";
import { Composer } from "@/components/hub/Composer";
import type { ComposerPayload } from "@/components/hub/Composer";
import {
  addMessage,
  conversationPartner,
  conversationTitle,
  createConversation,
  createMessage,
  findDirectConversation,
  lastMessage,
  messagesOf,
  readKey,
  sortConversations,
  toggleMessageReaction,
  unreadCount,
  visibleConversations,
} from "@/lib/chat-actions";
import { docToText } from "@/lib/rich";
import { localIsoNow, formatTime, plural } from "@/lib/dates";
import { createConversationAction, sendMessageAction } from "@/app/programs/[slug]/hub/actions";
import type { ChatData, ChatMessage, Conversation, Member } from "@/lib/types";

interface ChatViewProps {
  programSlug: string;
  data: ChatData;
  members: Member[];
  currentUser: Member;
  canManage: boolean;
  mentionNames: string[];
  /** Запись в базу доступна вошедшему участнику */
  persist?: boolean;
}

export function ChatView({
  programSlug,
  data,
  members,
  currentUser,
  canManage,
  mentionNames,
  persist = false,
}: ChatViewProps) {
  const [conversations, setConversations] = useState<Conversation[]>(data.conversations);
  const [messages, setMessages] = useState<ChatMessage[]>(data.messages);
  const [readState, setReadState] = useState<Record<string, string>>(data.readState);
  const [activeId, setActiveId] = useState<string | null>(null);
  const [query, setQuery] = useState("");
  const [dialog, setDialog] = useState<null | "group" | "direct">(null);
  const [replyTo, setReplyTo] = useState<ChatMessage | null>(null);

  const visible = useMemo(() => {
    const list = sortConversations(
      visibleConversations(conversations, currentUser.id),
      messages,
      currentUser.id,
      readState,
    );
    const needle = query.trim().toLowerCase();
    if (!needle) return list;
    return list.filter((conversation) =>
      conversationTitle(conversation, members, currentUser.id).toLowerCase().includes(needle),
    );
  }, [conversations, currentUser.id, members, messages, query, readState]);

  const totalUnread = useMemo(
    () =>
      visibleConversations(conversations, currentUser.id).reduce(
        (total, conversation) =>
          total + unreadCount(messages, conversation.id, currentUser.id, readState),
        0,
      ),
    [conversations, currentUser.id, messages, readState],
  );

  // Если активная беседа недоступна текущему пользователю — снимаем выбор.
  // Беседу не открываем автоматически: так видно, где есть непрочитанные.
  useEffect(() => {
    if (activeId && !visible.some((conversation) => conversation.id === activeId)) {
      setActiveId(null);
    }
  }, [activeId, visible]);

  // Открытая беседа считается прочитанной
  useEffect(() => {
    if (!activeId) return;
    const last = lastMessage(messages, activeId);
    if (!last) return;
    setReadState((previous) => {
      const key = readKey(currentUser.id, activeId);
      if (previous[key] === last.createdAt) return previous;
      return { ...previous, [key]: last.createdAt };
    });
  }, [activeId, currentUser.id, messages]);

  const activeConversation = conversations.find((conversation) => conversation.id === activeId);
  const activeMessages = activeId ? messagesOf(messages, activeId) : [];

  const send = (payload: ComposerPayload) => {
    if (!activeId) return;
    setMessages((previous) =>
      addMessage(
        previous,
        createMessage({
          conversationId: activeId,
          authorId: currentUser.id,
          body: payload.body,
          attachments: payload.attachments,
          createdAt: localIsoNow(),
          replyToId: replyTo?.id,
        }),
      ),
    );
    setReplyTo(null);

    if (persist) {
      void sendMessageAction({
        programSlug,
        conversationId: activeId,
        body: payload.body,
        attachments: payload.attachments,
        replyToId: replyTo?.id,
      });
    }
  };

  const createGroup = (input: { title: string; topic?: string; memberIds: string[] }) => {
    const conversation = createConversation({
      programSlug,
      kind: "group",
      title: input.title.trim(),
      topic: input.topic?.trim() || undefined,
      emoji: "💬",
      memberIds: [currentUser.id, ...input.memberIds],
      createdBy: currentUser.id,
      createdAt: localIsoNow(),
    });
    setConversations((previous) => [conversation, ...previous]);
    setActiveId(conversation.id);
    setDialog(null);

    if (persist) {
      void createConversationAction({
        programSlug,
        kind: "group",
        title: input.title.trim(),
        topic: input.topic?.trim() || undefined,
        emoji: "💬",
        memberIds: input.memberIds,
      });
    }
  };

  const openDirect = (memberId: string) => {
    const existing = findDirectConversation(conversations, currentUser.id, memberId);
    if (existing) {
      setActiveId(existing.id);
      setDialog(null);
      return;
    }
    const conversation = createConversation({
      programSlug,
      kind: "direct",
      memberIds: [currentUser.id, memberId],
      createdBy: currentUser.id,
      createdAt: localIsoNow(),
    });
    setConversations((previous) => [conversation, ...previous]);
    setActiveId(conversation.id);
    setDialog(null);
  };

  return (
    <div className="grid gap-5 lg:grid-cols-[340px_minmax(0,1fr)] lg:items-start">
      {/* ------------------------------------------------- Список бесед */}
      <aside className="card overflow-hidden p-0 lg:sticky lg:top-[96px]">
        <div className="flex items-center gap-2 border-b border-[var(--line)] px-5 py-4">
          <div className="min-w-0">
            <p className="eyebrow mb-0.5">Чаты программы</p>
            <p className="m-0 text-[12px] text-ink-faint">
              {plural(visibleConversations(conversations, currentUser.id).length, "беседа", "беседы", "бесед")}
              {totalUnread > 0 ? ` · непрочитанных ${totalUnread}` : ""}
            </p>
          </div>
          <div className="ml-auto flex gap-1.5">
            <button
              type="button"
              title="Новый личный диалог"
              onClick={() => setDialog("direct")}
              className="grid size-9 cursor-pointer place-items-center rounded-full border border-[var(--line)] bg-white text-navy transition-all duration-200 ease-brand hover:-translate-y-0.5"
            >
              <MessageSquarePlus size={15} />
            </button>
            {canManage && (
              <button
                type="button"
                title="Создать группу по направлению"
                onClick={() => setDialog("group")}
                className="grid size-9 cursor-pointer place-items-center rounded-full border border-[var(--line)] bg-white text-navy transition-all duration-200 ease-brand hover:-translate-y-0.5"
              >
                <Users size={15} />
              </button>
            )}
          </div>
        </div>

        <label className="mx-4 my-3 flex items-center gap-2 rounded-full border border-[var(--line)] px-4">
          <Search size={14} className="text-ink-faint" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск беседы"
            aria-label="Поиск беседы"
            className="min-h-10 w-full bg-transparent text-[13px] outline-none"
          />
        </label>

        <div className="max-h-[460px] overflow-auto pb-2">
          {visible.map((conversation) => {
            const last = lastMessage(messages, conversation.id);
            const unread = unreadCount(messages, conversation.id, currentUser.id, readState);
            const active = conversation.id === activeId;
            const partnerId = conversationPartner(conversation, currentUser.id);
            const partner = members.find((member) => member.id === partnerId);
            const title = conversationTitle(conversation, members, currentUser.id);

            return (
              <button
                key={conversation.id}
                type="button"
                onClick={() => setActiveId(conversation.id)}
                className={[
                  "flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors duration-150",
                  active ? "bg-navy text-white" : "hover:bg-[var(--color-sky-tint)]",
                ].join(" ")}
              >
                {conversation.kind === "group" ? (
                  <span
                    className="grid size-10 shrink-0 place-items-center rounded-[14px] text-[18px]"
                    style={{
                      background: active
                        ? "rgba(255,255,255,0.16)"
                        : "color-mix(in oklab, var(--accent) 14%, white)",
                    }}
                  >
                    {conversation.emoji ?? "💬"}
                  </span>
                ) : (
                  <Avatar member={partner} size={40} />
                )}

                <span className="min-w-0 flex-1">
                  <span className="flex items-center gap-2">
                    <span
                      className={[
                        "truncate text-[13.5px] font-semibold",
                        active ? "text-white" : "text-ink",
                      ].join(" ")}
                    >
                      {title}
                    </span>
                    {last && (
                      <span
                        className={[
                          "ml-auto shrink-0 text-[11px]",
                          active ? "text-white/70" : "text-ink-faint",
                        ].join(" ")}
                      >
                        {formatTime(last.createdAt)}
                      </span>
                    )}
                  </span>
                  <span className="mt-0.5 flex items-center gap-2">
                    <span
                      className={[
                        "truncate text-[12px]",
                        active ? "text-white/75" : "text-ink-faint",
                      ].join(" ")}
                    >
                      {last ? docToText(last.body).slice(0, 60) || "Вложение" : "Нет сообщений"}
                    </span>
                    {unread > 0 && (
                      <span
                        className="ml-auto grid min-w-[20px] shrink-0 place-items-center rounded-full px-1.5 py-0.5 text-[11px] font-semibold text-white"
                        style={{ background: active ? "rgba(255,255,255,0.28)" : "var(--accent)" }}
                      >
                        {unread}
                      </span>
                    )}
                  </span>
                </span>
              </button>
            );
          })}

          {visible.length === 0 && (
            <p className="m-0 px-4 py-6 text-center text-[13px] text-ink-faint">
              Бесед пока нет. Начните личный диалог или создайте группу.
            </p>
          )}
        </div>
      </aside>

      {/* -------------------------------------------------- Активная беседа */}
      {activeConversation ? (
        <section className="card overflow-hidden p-0">
          <div className="flex flex-wrap items-center gap-4 border-b border-[var(--line)] px-6 py-4">
            {activeConversation.kind === "group" ? (
              <span
                className="grid size-11 shrink-0 place-items-center rounded-[14px] text-[20px]"
                style={{ background: "color-mix(in oklab, var(--accent) 14%, white)" }}
              >
                {activeConversation.emoji ?? "💬"}
              </span>
            ) : (
              <Avatar
                member={members.find(
                  (member) => member.id === conversationPartner(activeConversation, currentUser.id),
                )}
                size={44}
              />
            )}

            <div className="min-w-0">
              <h2 className="m-0 font-display text-[19px] leading-tight font-semibold tracking-[-0.02em] text-navy">
                {conversationTitle(activeConversation, members, currentUser.id)}
              </h2>
              <p className="m-0 text-[12px] text-ink-faint">
                {activeConversation.kind === "group"
                  ? `${activeConversation.memberIds.length} ${plural(
                      activeConversation.memberIds.length,
                      "участник",
                      "участника",
                      "участников",
                    )}${activeConversation.topic ? ` · ${activeConversation.topic}` : ""}`
                  : "Личный диалог"}
              </p>
            </div>

            {activeConversation.kind === "group" && (
              <div className="ml-auto flex items-center gap-1.5">
                {activeConversation.memberIds.slice(0, 6).map((memberId) => (
                  <Avatar
                    key={memberId}
                    member={members.find((member) => member.id === memberId)}
                    size={28}
                  />
                ))}
                {activeConversation.memberIds.length > 6 && (
                  <span className="text-[12px] text-ink-faint">
                    +{activeConversation.memberIds.length - 6}
                  </span>
                )}
              </div>
            )}
          </div>

          <div className="max-h-[560px] overflow-auto bg-[var(--color-paper-warm)] px-6 py-5">
            <MessageFeed
              conversation={activeConversation}
              messages={activeMessages}
              members={members}
              currentUser={currentUser}
              mentionNames={mentionNames}
              replyTo={replyTo}
              onSetReply={setReplyTo}
              onToggleReaction={(messageId, emoji) =>
                setMessages((previous) => toggleMessageReaction(previous, messageId, emoji))
              }
            />
          </div>

          <div className="border-t border-[var(--line)] px-5 py-4">
            {replyTo && (
              <div
                data-reply-banner="true"
                className="mb-3 flex items-start gap-3 rounded-[14px] border border-[var(--line)] bg-[var(--color-sky-tint)] px-4 py-2.5"
              >
                <div className="min-w-0 flex-1">
                  <p className="m-0 text-[11px] font-semibold text-sky-ink">
                    Ответ{" "}
                    {members.find((member) => member.id === replyTo.authorId)?.name ?? "участнику"}
                  </p>
                  <p className="m-0 truncate text-[12px] text-ink-soft">
                    {docToText(replyTo.body).slice(0, 120)}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setReplyTo(null)}
                  aria-label="Отменить ответ"
                  className="cursor-pointer text-ink-faint transition-colors duration-200 hover:text-navy"
                >
                  <X size={14} />
                </button>
              </div>
            )}

            <Composer
              mode="comment"
              compact
              members={members}
              placeholder="Сообщение в чат…"
              submitLabel="Отправить"
              onSubmit={send}
            />
          </div>
        </section>
      ) : (
        <section className="card grid min-h-[320px] place-items-center p-8 text-center">
          <div>
            <p className="m-0 mb-1.5 font-display text-lg font-semibold text-navy">
              Выберите беседу
            </p>
            <p className="m-0 text-[13px] text-ink-faint">
              Слева — группы по направлениям и личные диалоги участников.
            </p>
          </div>
        </section>
      )}

      {dialog && (
        <NewChatDialog
          mode={dialog}
          members={members}
          currentUserId={currentUser.id}
          onClose={() => setDialog(null)}
          onCreateGroup={createGroup}
          onOpenDirect={openDirect}
        />
      )}
    </div>
  );
}
