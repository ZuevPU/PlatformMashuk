"use client";

import { CornerUpLeft, Paperclip, Trash2 } from "lucide-react";
import { Avatar, RoleBadge } from "@/components/hub/Avatar";
import { ReactionBar } from "@/components/hub/ReactionBar";
import { RichText } from "@/components/hub/RichText";
import type { ChatMessage, Conversation, Member } from "@/lib/types";
import { docToText } from "@/lib/rich";
import { formatDayMonth, formatTime } from "@/lib/dates";
import { groupByDay } from "@/lib/chat-actions";

interface MessageFeedProps {
  conversation: Conversation;
  messages: ChatMessage[];
  members: Member[];
  currentUser: Member;
  mentionNames: string[];
  replyTo: ChatMessage | null;
  onSetReply: (message: ChatMessage | null) => void;
  onToggleReaction: (messageId: string, emoji: string) => void;
  /** Команда программы может удалять сообщения */
  canManage: boolean;
  onDelete: (messageId: string) => void;
}

export function MessageFeed({
  conversation,
  messages,
  members,
  currentUser,
  mentionNames,
  replyTo,
  onSetReply,
  onToggleReaction,
  canManage,
  onDelete,
}: MessageFeedProps) {
  if (messages.length === 0) {
    return (
      <div className="grid min-h-80 place-items-center rounded-panel border border-dashed border-[var(--line)] bg-white/60 px-6 text-center">
        <div>
          <p className="m-0 mb-1.5 font-display text-lg font-semibold text-navy">
            Здесь пока тихо
          </p>
          <p className="m-0 text-meta text-ink-faint">
            Напишите первое сообщение — участники увидят его сразу.
          </p>
        </div>
      </div>
    );
  }

  const groups = groupByDay(messages);

  return (
    <div className="flex flex-col gap-6">
      {groups.map((group) => (
        <div key={group.date} className="flex flex-col gap-3.5">
          <div className="flex items-center gap-3">
            <span className="h-px flex-1 bg-[var(--line)]" />
            <span className="text-micro font-semibold tracking-[0.1em] text-ink-faint uppercase">
              {formatDayMonth(group.date)}
            </span>
            <span className="h-px flex-1 bg-[var(--line)]" />
          </div>

          {group.messages.map((message) => {
            const author = members.find((member) => member.id === message.authorId);
            const isOwn = message.authorId === currentUser.id;
            const replied = message.replyToId
              ? messages.find((item) => item.id === message.replyToId)
              : undefined;
            const repliedAuthor = replied
              ? members.find((member) => member.id === replied.authorId)
              : undefined;

            return (
              <div
                key={message.id}
                className={["flex gap-3", isOwn ? "flex-row-reverse" : ""].join(" ")}
              >
                {!isOwn && <Avatar member={author} size={34} />}

                <div
                  className={[
                    "flex min-w-0 max-w-[min(680px,88%)] flex-col",
                    isOwn ? "items-end" : "items-start",
                  ].join(" ")}
                >
                  {!isOwn && conversation.kind === "group" && (
                    <div className="mb-1.5 flex flex-wrap items-center gap-2">
                      <span className="text-meta font-semibold text-ink">
                        {author?.name ?? "Участник"}
                      </span>
                      {author && <RoleBadge role={author.role} />}
                    </div>
                  )}

                  <div
                    className="w-full rounded-soft border px-4 py-3"
                    style={
                      isOwn
                        ? {
                            background: "color-mix(in oklab, var(--accent) 11%, white)",
                            borderColor: "color-mix(in oklab, var(--accent) 28%, white)",
                          }
                        : {
                            background: "#fff",
                            borderColor: "var(--line)",
                            boxShadow: "var(--shadow-soft)",
                          }
                    }
                  >
                    {replied && (
                      <div className="mb-2.5 border-l-2 border-[var(--accent)] pl-3">
                        <p className="m-0 text-micro font-semibold text-ink-soft">
                          {repliedAuthor?.name ?? "Участник"}
                        </p>
                        <p className="m-0 line-clamp-2 text-caption text-ink-faint">
                          {docToText(replied.body).slice(0, 120)}
                        </p>
                      </div>
                    )}

                    <RichText content={message.body} mentionNames={mentionNames} compact />

                    {message.attachments.length > 0 && (
                      <div className="mt-3 grid gap-2 sm:grid-cols-2">
                        {message.attachments.map((attachment) => (
                          <a
                            key={attachment.id}
                            href={attachment.url}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="block overflow-hidden rounded-field border border-[var(--line)]"
                          >
                            {/* eslint-disable-next-line @next/next/no-img-element -- вложение чата */}
                            <img
                              src={attachment.url}
                              alt={attachment.alt}
                              loading="lazy"
                              className="max-h-65 w-full object-cover"
                            />
                          </a>
                        ))}
                      </div>
                    )}

                    <p className="m-0 mt-2 flex items-center gap-1.5 text-micro text-ink-faint">
                      {message.attachments.length > 0 && <Paperclip size={11} />}
                      {formatTime(message.createdAt)}
                    </p>
                  </div>

                  <div className="mt-2 flex flex-wrap items-center gap-2">
                    <ReactionBar
                      reactions={message.reactions}
                      onToggle={(emoji) => onToggleReaction(message.id, emoji)}
                      compact
                    />
                    <button
                      type="button"
                      onClick={() => onSetReply(replyTo?.id === message.id ? null : message)}
                      className={[
                        "inline-flex cursor-pointer items-center gap-1.5 text-micro font-medium transition-colors duration-200",
                        replyTo?.id === message.id ? "text-navy" : "text-ink-faint hover:text-navy",
                      ].join(" ")}
                    >
                      <CornerUpLeft size={12} />
                      Ответить
                    </button>
                    {canManage && (
                      <button
                        type="button"
                        onClick={() => {
                          if (window.confirm("Удалить сообщение?")) onDelete(message.id);
                        }}
                        className="inline-flex cursor-pointer items-center gap-1.5 text-micro font-medium text-ink-faint transition-colors duration-200 hover:text-autumn-ink"
                      >
                        <Trash2 size={12} />
                        Удалить
                      </button>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      ))}
    </div>
  );
}
