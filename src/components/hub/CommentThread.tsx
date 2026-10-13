"use client";

import { useState } from "react";
import { CornerDownRight } from "lucide-react";
import { Avatar, RoleBadge } from "./Avatar";
import { ReactionBar } from "./ReactionBar";
import { RichText } from "./RichText";
import { Composer } from "./LazyComposer";
import type { ComposerPayload } from "./Composer";
import type { Comment, Member } from "@/lib/types";
import { formatDateTimeLabel } from "@/lib/dates";

interface CommentThreadProps {
  comments: Comment[];
  members: Member[];
  mentionNames: string[];
  onReply: (commentId: string, payload: ComposerPayload) => void;
  onToggleReaction: (commentId: string, emoji: string) => void;
}

interface CommentItemProps {
  comment: Comment;
  members: Member[];
  mentionNames: string[];
  onReply: (commentId: string, payload: ComposerPayload) => void;
  onToggleReaction: (commentId: string, emoji: string) => void;
  isReply?: boolean;
}

export function CommentThread({
  comments,
  members,
  mentionNames,
  onReply,
  onToggleReaction,
}: CommentThreadProps) {
  if (comments.length === 0) {
    return (
      <p className="m-0 text-meta text-ink-faint">
        Комментариев пока нет — задайте вопрос первым.
      </p>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      {comments.map((comment) => (
        <CommentItem
          key={comment.id}
          comment={comment}
          members={members}
          mentionNames={mentionNames}
          onReply={onReply}
          onToggleReaction={onToggleReaction}
        />
      ))}
    </div>
  );
}

function CommentItem({
  comment,
  members,
  mentionNames,
  onReply,
  onToggleReaction,
  isReply = false,
}: CommentItemProps) {
  const [replyOpen, setReplyOpen] = useState(false);
  const author = members.find((member) => member.id === comment.authorId);

  return (
    <div className={isReply ? "border-l border-[var(--line)] pl-4" : undefined}>
      <div className="flex gap-3">
        <Avatar member={author} size={isReply ? 30 : 34} />
        <div className="min-w-0 flex-1">
          <div className="mb-1.5 flex flex-wrap items-center gap-2">
            <span className="text-ui font-semibold text-ink">{author?.name ?? "Участник"}</span>
            {author && <RoleBadge role={author.role} />}
            <span className="text-caption text-ink-faint">{formatDateTimeLabel(comment.createdAt)}</span>
          </div>

          <RichText content={comment.body} mentionNames={mentionNames} compact />

          <div className="mt-2.5 flex flex-wrap items-center gap-3">
            <ReactionBar
              reactions={comment.reactions}
              onToggle={(emoji) => onToggleReaction(comment.id, emoji)}
              compact
            />
            <button
              type="button"
              onClick={() => setReplyOpen((value) => !value)}
              className="inline-flex cursor-pointer items-center gap-1.5 text-caption font-medium text-ink-faint transition-colors duration-200 hover:text-navy"
            >
              <CornerDownRight size={13} />
              Ответить
            </button>
          </div>

          {replyOpen && (
            <div className="mt-3">
              <Composer
                mode="comment"
                compact
                autoFocus
                members={members}
                placeholder={`Ответ ${author?.name.split(" ")[0] ?? ""}…`}
                onCancel={() => setReplyOpen(false)}
                onSubmit={(payload) => {
                  onReply(comment.id, payload);
                  setReplyOpen(false);
                }}
              />
            </div>
          )}

          {comment.replies.length > 0 && (
            <div className="mt-4 flex flex-col gap-4">
              {comment.replies.map((reply) => (
                <CommentItem
                  key={reply.id}
                  comment={reply}
                  members={members}
                  mentionNames={mentionNames}
                  onReply={onReply}
                  onToggleReaction={onToggleReaction}
                  isReply
                />
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
