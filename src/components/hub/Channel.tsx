"use client";

import { Info, Users } from "lucide-react";
import { PostCard } from "./PostCard";
import type { PostCardHandlers } from "./PostCard";
import { Composer } from "./LazyComposer";
import type { ComposerPayload } from "./Composer";
import type { Member, Post } from "@/lib/types";
import { countComments } from "@/lib/hub-actions";

interface ChannelProps extends PostCardHandlers {
  posts: Post[];
  members: Member[];
  mentionNames: string[];
  currentUser: Member;
  canPost: boolean;
  canModerate: boolean;
  onPublish: (payload: ComposerPayload) => void;
}

export function Channel({
  posts,
  members,
  mentionNames,
  currentUser,
  canPost,
  canModerate,
  onPublish,
  ...handlers
}: ChannelProps) {
  const comments = posts.reduce((total, post) => total + countComments(post.comments), 0);

  return (
    <div className="flex flex-col gap-5">
      <section className="mesh mesh--accent rounded-card p-7">
        <p className="eyebrow eyebrow--light mb-2">Канал программы</p>
        <h2 className="m-0 mb-3 font-display text-[clamp(24px,3vw,34px)] leading-tight font-semibold tracking-[-0.035em] text-white">
          Объявления команды и обсуждение участников
        </h2>
        <p className="m-0 max-w-155 text-ui leading-relaxed text-white/78">
          Посты публикуют команда Центра и модераторы программы. Вопросы и наблюдения — в
          комментариях к нужному посту, чтобы обсуждение не терялось.
        </p>

        <div className="mt-6 flex flex-wrap gap-2.5">
          <span className="glass px-4 py-2 text-meta text-white/85">
            {posts.length} {posts.length === 1 ? "пост" : posts.length < 5 ? "поста" : "постов"}
          </span>
          <span className="glass px-4 py-2 text-meta text-white/85">
            {comments} {comments === 1 ? "комментарий" : comments < 5 ? "комментария" : "комментариев"}
          </span>
          <span className="glass inline-flex items-center gap-2 px-4 py-2 text-meta text-white/85">
            <Users size={14} />
            {members.length} участников
          </span>
        </div>
      </section>

      {canPost ? (
        <Composer mode="post" members={members} onSubmit={onPublish} />
      ) : (
        <p className="m-0 flex items-start gap-2.5 rounded-soft border border-[var(--line)] bg-white px-5 py-4 text-meta leading-relaxed text-ink-soft">
          <Info size={16} className="mt-0.5 shrink-0 text-sky-ink" />
          Посты в канале публикует команда Центра и модераторы программы. Вы можете
          комментировать, отвечать и ставить реакции.
        </p>
      )}

      <div className="flex flex-col gap-4">
        {posts.map((post) => (
          <PostCard
            key={post.id}
            post={post}
            members={members}
            mentionNames={mentionNames}
            currentUser={currentUser}
            canModerate={canModerate}
            {...handlers}
          />
        ))}
      </div>
    </div>
  );
}
