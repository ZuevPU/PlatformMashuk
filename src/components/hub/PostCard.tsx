"use client";

import { useState } from "react";
import { MessageSquare, Pin, PinOff, Trash2 } from "lucide-react";
import { Avatar, RoleBadge } from "./Avatar";
import { ReactionBar } from "./ReactionBar";
import { RichText } from "./RichText";
import { Composer } from "./LazyComposer";
import { CommentThread } from "./CommentThread";
import type { ComposerPayload } from "./Composer";
import type { Member, Post } from "@/lib/types";
import { countComments } from "@/lib/hub-actions";
import { formatDateTimeLabel } from "@/lib/dates";

export interface PostCardHandlers {
  onToggleReaction: (postId: string, emoji: string) => void;
  onToggleCommentReaction: (postId: string, commentId: string, emoji: string) => void;
  onTogglePin: (postId: string) => void;
  onDeletePost: (postId: string) => void;
  onAddComment: (postId: string, payload: ComposerPayload) => void;
  onAddReply: (postId: string, commentId: string, payload: ComposerPayload) => void;
}

interface PostCardProps extends PostCardHandlers {
  post: Post;
  members: Member[];
  mentionNames: string[];
  currentUser: Member;
  canModerate: boolean;
}

export function PostCard({
  post,
  members,
  mentionNames,
  currentUser,
  canModerate,
  onToggleReaction,
  onToggleCommentReaction,
  onTogglePin,
  onDeletePost,
  onAddComment,
  onAddReply,
}: PostCardProps) {
  // Комментарии скрыты по умолчанию — открываются кнопкой под постом
  const [commentsOpen, setCommentsOpen] = useState(false);
  const author = members.find((member) => member.id === post.authorId);
  const total = countComments(post.comments);

  return (
    <article className="card p-6 md:p-7">
      <header className="mb-4 flex flex-wrap items-start gap-3.5">
        <Avatar member={author} />
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <span className="text-body font-semibold text-ink">{author?.name ?? "Участник"}</span>
            {author && <RoleBadge role={author.role} />}
            {post.pinned && (
              <span
                className="inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-micro font-semibold tracking-[0.06em] uppercase"
                style={{
                  background: "color-mix(in oklab, var(--accent) 14%, white)",
                  color: "var(--accent-ink)",
                }}
              >
                <Pin size={11} />
                Закреплено
              </span>
            )}
          </div>
          <p className="m-0 mt-0.5 text-caption text-ink-faint">
            {formatDateTimeLabel(post.createdAt)}
          </p>
        </div>

        {canModerate && (
          <button
            type="button"
            onClick={() => onTogglePin(post.id)}
            title={post.pinned ? "Снять закреп" : "Закрепить пост"}
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-[var(--line)] bg-white px-3 py-1.5 text-caption font-medium text-ink-soft transition-all duration-200 ease-brand hover:-translate-y-0.5 hover:text-navy"
          >
            {post.pinned ? <PinOff size={13} /> : <Pin size={13} />}
            {post.pinned ? "Снять" : "Закрепить"}
          </button>
        )}

        {canModerate && (
          <button
            type="button"
            onClick={() => {
              if (window.confirm("Удалить пост? Комментарии к нему тоже удалятся.")) {
                onDeletePost(post.id);
              }
            }}
            title="Удалить пост"
            className="inline-flex cursor-pointer items-center gap-1.5 rounded-full border border-autumn/40 bg-white px-3 py-1.5 text-caption font-medium text-autumn-ink transition-all duration-200 ease-brand hover:-translate-y-0.5"
          >
            <Trash2 size={13} />
            Удалить
          </button>
        )}
      </header>

      {post.title && (
        <h3 className="m-0 mb-3 font-display text-[clamp(20px,2.4vw,26px)] leading-tight font-semibold tracking-[-0.03em] text-navy">
          {post.title}
        </h3>
      )}

      <RichText content={post.body} mentionNames={mentionNames} />

      {post.attachments.length > 0 && (
        <div
          className={
            post.attachments.length === 1 ? "mt-4" : "mt-4 grid gap-2.5 sm:grid-cols-2"
          }
        >
          {post.attachments.map((attachment) => (
            <a
              key={attachment.id}
              href={attachment.url}
              target="_blank"
              rel="noopener noreferrer"
              className={[
                "overflow-hidden rounded-2xl border border-[var(--line)] transition-transform duration-200 ease-brand hover:-translate-y-0.5",
                post.attachments.length === 1 ? "inline-block max-w-full" : "block",
              ].join(" ")}
            >
              {/* eslint-disable-next-line @next/next/no-img-element -- вложение канала */}
              <img
                src={attachment.url}
                alt={attachment.alt}
                loading="lazy"
                className={
                  post.attachments.length === 1
                    ? "max-h-90 w-auto max-w-full object-contain"
                    : "max-h-80 w-full object-cover"
                }
              />
            </a>
          ))}
        </div>
      )}

      <div className="mt-5">
        <ReactionBar
          reactions={post.reactions}
          onToggle={(emoji) => onToggleReaction(post.id, emoji)}
        />
      </div>

      <div className="mt-5 border-t border-[var(--line)] pt-4">
        <button
          type="button"
          onClick={() => setCommentsOpen((value) => !value)}
          className="inline-flex cursor-pointer items-center gap-2 text-meta font-semibold text-navy transition-opacity duration-200 hover:opacity-75"
        >
          <MessageSquare size={15} />
          {total > 0
            ? `${total} ${total === 1 ? "комментарий" : total < 5 ? "комментария" : "комментариев"}`
            : "Комментировать"}
        </button>

        {commentsOpen && (
          <div className="mt-5 flex flex-col gap-6">
            <CommentThread
              comments={post.comments}
              members={members}
              mentionNames={mentionNames}
              onReply={(commentId, payload) => onAddReply(post.id, commentId, payload)}
              onToggleReaction={(commentId, emoji) =>
                onToggleCommentReaction(post.id, commentId, emoji)
              }
            />

            <Composer
              mode="comment"
              compact
              members={members}
              placeholder="Написать комментарий…"
              onSubmit={(payload) => onAddComment(post.id, payload)}
            />
          </div>
        )}
      </div>
    </article>
  );
}
