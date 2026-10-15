"use client";

import { PostCard } from "./PostCard";
import type { PostCardHandlers } from "./PostCard";
import { Composer } from "./LazyComposer";
import type { ComposerPayload } from "./Composer";
import type { Member, Post } from "@/lib/types";

interface ChannelProps extends PostCardHandlers {
  posts: Post[];
  members: Member[];
  mentionNames: string[];
  currentUser: Member;
  programTitle: string;
  canPost: boolean;
  canModerate: boolean;
  onPublish: (payload: ComposerPayload) => void;
}

export function Channel({
  posts,
  members,
  mentionNames,
  currentUser,
  programTitle,
  canPost,
  canModerate,
  onPublish,
  ...handlers
}: ChannelProps) {
  return (
    <div className="flex flex-col gap-5">
      <section className="mesh mesh--accent rounded-card p-7">
        <p className="eyebrow eyebrow--light mb-2">Канал программы</p>
        <h2 className="m-0 font-display text-[clamp(24px,3vw,34px)] leading-tight font-semibold tracking-[-0.035em] text-white">
          {programTitle}
        </h2>
      </section>

      {canPost ? (
        <Composer mode="post" members={members} onSubmit={onPublish} />
      ) : (
        <details className="rounded-soft border border-[var(--line)] bg-white px-5 py-4">
          <summary className="cursor-pointer text-meta font-semibold text-navy">
            Кто может писать в канале
          </summary>
          <p className="m-0 mt-2.5 text-meta leading-relaxed text-ink-soft">
            Посты публикуют команда Центра и модераторы программы. Вы можете комментировать,
            отвечать и ставить реакции.
          </p>
        </details>
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
