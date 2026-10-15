import { uuid } from "./uid";
import type { Comment, Member, Post, ReactionSummary } from "./types";

/** Имена для подсветки упоминаний в текстах канала. */
export function mentionNames(members: Member[]): string[] {
  return members.map((member) => member.name.split(" ")[0]);
}

/** Переключает реакцию: поставить, снять, убрать обнулившуюся. */
export function toggleReaction(list: ReactionSummary[], emoji: string): ReactionSummary[] {
  const existing = list.find((item) => item.emoji === emoji);

  if (!existing) return [...list, { emoji, count: 1, mine: true }];

  if (existing.mine) {
    return list
      .map((item) =>
        item.emoji === emoji ? { ...item, count: Math.max(0, item.count - 1), mine: false } : item,
      )
      .filter((item) => item.count > 0);
  }

  return list.map((item) =>
    item.emoji === emoji ? { ...item, count: item.count + 1, mine: true } : item,
  );
}

/** Рекурсивно обновляет комментарии, включая ответы. */
export function mapCommentTree(comments: Comment[], fn: (comment: Comment) => Comment): Comment[] {
  return comments.map((comment) => fn({ ...comment, replies: mapCommentTree(comment.replies, fn) }));
}

/** Закреплённые посты — сверху, дальше по времени публикации. */
export function sortPosts(posts: Post[]): Post[] {
  return [...posts].sort(
    (a, b) => Number(b.pinned) - Number(a.pinned) || b.createdAt.localeCompare(a.createdAt),
  );
}

export function togglePostReaction(posts: Post[], postId: string, emoji: string): Post[] {
  return posts.map((post) =>
    post.id === postId ? { ...post, reactions: toggleReaction(post.reactions, emoji) } : post,
  );
}

export function toggleCommentReaction(
  posts: Post[],
  postId: string,
  commentId: string,
  emoji: string,
): Post[] {
  return posts.map((post) =>
    post.id === postId
      ? {
          ...post,
          comments: mapCommentTree(post.comments, (comment) =>
            comment.id === commentId
              ? { ...comment, reactions: toggleReaction(comment.reactions, emoji) }
              : comment,
          ),
        }
      : post,
  );
}

export function togglePinned(posts: Post[], postId: string): Post[] {
  return posts.map((post) => (post.id === postId ? { ...post, pinned: !post.pinned } : post));
}

/** Удаление поста из ленты (команда программы). */
export function removePost(posts: Post[], postId: string): Post[] {
  return posts.filter((post) => post.id !== postId);
}

export function addComment(posts: Post[], postId: string, comment: Comment): Post[] {
  return posts.map((post) =>
    post.id === postId ? { ...post, comments: [...post.comments, comment] } : post,
  );
}

export function addReply(
  posts: Post[],
  postId: string,
  commentId: string,
  reply: Comment,
): Post[] {
  return posts.map((post) =>
    post.id === postId
      ? {
          ...post,
          comments: mapCommentTree(post.comments, (comment) =>
            comment.id === commentId
              ? { ...comment, replies: [...comment.replies, reply] }
              : comment,
          ),
        }
      : post,
  );
}

export function createPost(input: {
  programSlug: string;
  authorId: string;
  title?: string;
  body: Post["body"];
  attachments: Post["attachments"];
  createdAt: string;
}): Post {
  return {
    id: `post-${uuid()}`,
    programSlug: input.programSlug,
    authorId: input.authorId,
    title: input.title,
    body: input.body,
    attachments: input.attachments,
    createdAt: input.createdAt,
    pinned: false,
    reactions: [],
    comments: [],
  };
}

export function createComment(input: {
  authorId: string;
  body: Comment["body"];
  createdAt: string;
}): Comment {
  return {
    id: `comment-${uuid()}`,
    authorId: input.authorId,
    body: input.body,
    createdAt: input.createdAt,
    reactions: [],
    replies: [],
  };
}

export function countComments(comments: Comment[]): number {
  return comments.reduce((total, comment) => total + 1 + countComments(comment.replies), 0);
}
