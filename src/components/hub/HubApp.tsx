"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  ExternalLink,
  LayoutTemplate,
  LogOut,
  MapPin,
  MessagesSquare,
  Megaphone,
  Settings,
  Users,
} from "lucide-react";
import { Channel } from "./Channel";
import type { ComposerPayload } from "./Composer";
import { MembersView } from "./MembersView";
import { useLiveHub } from "./useLiveHub";
import { ChatView } from "@/components/chat/ChatView";
import { PollsView } from "@/components/polls/PollsView";
import { DaySchedule } from "@/components/programs/DaySchedule";
import { StatusChip } from "@/components/programs/StatusChip";
import {
  addCommentAction,
  createPostAction,
  togglePinAction,
  toggleReactionAction,
} from "@/app/programs/[slug]/hub/actions";
import { logoutAction } from "@/lib/auth-actions";
import {
  addComment,
  addReply,
  createComment,
  createPost,
  mentionNames as buildMentionNames,
  sortPosts,
  toggleCommentReaction,
  togglePinned,
  togglePostReaction,
} from "@/lib/hub-actions";
import { unreadCount, visibleConversations } from "@/lib/chat-actions";
import { localIsoNow } from "@/lib/dates";
import { SEASONS, seasonStyle } from "@/lib/brand";
import type { HubParts } from "@/lib/hub-data";
import type {
  Comment,
  Member,
  MemberRole,
  Post,
  ProgramDay,
  ProgramStatus,
  SeasonKey,
} from "@/lib/types";
import { MEMBER_ROLE_LABELS } from "@/lib/types";

export interface HubProgram {
  slug: string;
  title: string;
  subtitle: string;
  stream?: string;
  status: ProgramStatus;
  season: SeasonKey;
  dates: string;
  location: string;
  participants?: number;
  materialsCount: number;
  days: ProgramDay[];
  hasBuild: boolean;
  landing?: { url: string; code?: string };
}

export type HubSection = "channel" | "schedule" | "build" | "chats" | "members" | "polls";

export interface HubSession {
  memberId: string;
  name: string;
  role: MemberRole;
}

/** Свои посты и комментарии, ещё не подтверждённые базой. */
type PendingOp =
  | { kind: "post"; post: Post }
  | { kind: "comment"; postId: string; comment: Comment }
  | { kind: "reply"; postId: string; parentId: string; comment: Comment };

function collectIds(posts: Post[]): Set<string> {
  const ids = new Set<string>();
  const walk = (comments: Comment[]) => {
    for (const comment of comments) {
      ids.add(comment.id);
      walk(comment.replies);
    }
  };
  for (const post of posts) {
    ids.add(post.id);
    walk(post.comments);
  }
  return ids;
}

function applyPending(server: Post[], ops: PendingOp[]): Post[] {
  const known = collectIds(server);
  let posts = server;
  for (const op of ops) {
    if (op.kind === "post" && !known.has(op.post.id)) posts = [op.post, ...posts];
    if (op.kind === "comment" && !known.has(op.comment.id)) {
      posts = addComment(posts, op.postId, op.comment);
    }
    if (op.kind === "reply" && !known.has(op.comment.id)) {
      posts = addReply(posts, op.postId, op.parentId, op.comment);
    }
  }
  return sortPosts(posts);
}

export function HubApp({
  program,
  initial,
  session,
  initialSection = "channel",
}: {
  program: HubProgram;
  initial: HubParts;
  session: HubSession;
  initialSection?: HubSection;
}) {
  const router = useRouter();
  const staff = session.role === "admin" || session.role === "moderator";
  const { parts } = useLiveHub(program.slug, initial, staff);

  const [section, setSection] = useState<HubSection>(initialSection);
  const [posts, setPosts] = useState<Post[]>(parts.channel);
  const [actionError, setActionError] = useState<string | null>(null);
  const pendingOps = useRef<PendingOp[]>([]);

  // Свежая лента с сервера + свои неподтверждённые записи
  useEffect(() => {
    const known = collectIds(parts.channel);
    pendingOps.current = pendingOps.current.filter((op) =>
      op.kind === "post" ? !known.has(op.post.id) : !known.has(op.comment.id),
    );
    setPosts(applyPending(parts.channel, pendingOps.current));
  }, [parts.channel]);

  // На телефоне меню — горизонтальная лента: активная вкладка всегда в поле зрения
  const navRef = useRef<HTMLElement>(null);
  useEffect(() => {
    navRef.current
      ?.querySelector('[aria-current="page"]')
      ?.scrollIntoView({ block: "nearest", inline: "center", behavior: "smooth" });
  }, [section]);

  const openSection = (next: HubSection) => {
    setSection(next);
    // Ссылку на раздел можно переслать: /hub?tab=chats
    router.replace(next === "channel" ? "?" : `?tab=${next}`, { scroll: false });
  };

  const season = SEASONS[program.season];
  const members = parts.members;

  const currentUser = useMemo<Member>(
    () =>
      members.find((member) => member.id === session.memberId) ?? {
        id: session.memberId,
        name: session.name,
        role: session.role,
      },
    [members, session],
  );

  const names = useMemo(() => buildMentionNames(members), [members]);

  const report = (result: { ok: true } | { ok: false; error: string }) => {
    if (!result.ok) setActionError(result.error);
  };

  const track = (op: PendingOp, run: () => Promise<{ ok: true } | { ok: false; error: string }>) => {
    pendingOps.current.push(op);
    void run().then((result) => {
      if (result.ok) return;
      pendingOps.current = pendingOps.current.filter((item) => item !== op);
      setPosts(applyPending(parts.channel, pendingOps.current));
      setActionError(result.error);
    });
  };

  const publish = (payload: ComposerPayload) => {
    const post = createPost({
      programSlug: program.slug,
      authorId: currentUser.id,
      title: payload.title,
      body: payload.body,
      attachments: payload.attachments,
      createdAt: localIsoNow(),
    });
    setPosts((previous) => sortPosts([post, ...previous]));
    track({ kind: "post", post }, () =>
      createPostAction({
        programSlug: program.slug,
        id: post.id,
        title: payload.title,
        body: payload.body,
        attachments: payload.attachments,
      }),
    );
  };

  const handlers = {
    onToggleReaction: (postId: string, emoji: string) => {
      setPosts((previous) => togglePostReaction(previous, postId, emoji));
      void toggleReactionAction({
        programSlug: program.slug,
        targetType: "post",
        targetId: postId,
        emoji,
      }).then(report);
    },
    onToggleCommentReaction: (postId: string, commentId: string, emoji: string) => {
      setPosts((previous) => toggleCommentReaction(previous, postId, commentId, emoji));
      void toggleReactionAction({
        programSlug: program.slug,
        targetType: "comment",
        targetId: commentId,
        emoji,
      }).then(report);
    },
    onTogglePin: (postId: string) => {
      const target = posts.find((post) => post.id === postId);
      if (!target) return;
      setPosts((previous) => sortPosts(togglePinned(previous, postId)));
      void togglePinAction({ programSlug: program.slug, postId, pinned: !target.pinned }).then(
        report,
      );
    },
    onAddComment: (postId: string, payload: ComposerPayload) => {
      const comment = createComment({
        authorId: currentUser.id,
        body: payload.body,
        createdAt: localIsoNow(),
      });
      setPosts((previous) => addComment(previous, postId, comment));
      track({ kind: "comment", postId, comment }, () =>
        addCommentAction({ programSlug: program.slug, id: comment.id, postId, body: payload.body }),
      );
    },
    onAddReply: (postId: string, commentId: string, payload: ComposerPayload) => {
      const comment = createComment({
        authorId: currentUser.id,
        body: payload.body,
        createdAt: localIsoNow(),
      });
      setPosts((previous) => addReply(previous, postId, commentId, comment));
      track({ kind: "reply", postId, parentId: commentId, comment }, () =>
        addCommentAction({
          programSlug: program.slug,
          id: comment.id,
          postId,
          parentId: commentId,
          body: payload.body,
        }),
      );
    },
  };

  const conversations = visibleConversations(parts.chats.conversations, currentUser.id);
  const unread = conversations.reduce(
    (total, conversation) =>
      total + unreadCount(parts.chats.messages, conversation.id, currentUser.id, parts.chats.readState),
    0,
  );
  const livePoll = parts.polls.sessions.some((item) => item.status === "live");
  const hasBuildSection = program.hasBuild || Boolean(program.landing);

  // Разделы рабочего пространства — как вкладки мессенджера: канал, чат участников,
  // расписание, опросы, участники, а в самом конце — материалы программы.
  const navItems: {
    key: HubSection;
    label: string;
    short: string;
    Icon: typeof Megaphone;
    badge?: string;
    highlight?: boolean;
  }[] = [
    {
      key: "channel",
      label: "Канал программы",
      short: "Канал",
      Icon: Megaphone,
      badge: String(posts.length),
    },
    {
      key: "chats",
      label: "Чат участников",
      short: "Чат",
      Icon: MessagesSquare,
      badge: unread ? String(unread) : String(conversations.length),
      highlight: unread > 0,
    },
    {
      key: "schedule",
      label: "Расписание",
      short: "Расписание",
      Icon: CalendarDays,
      badge: program.days.length ? `${program.days.length} дн.` : undefined,
    },
    {
      key: "polls",
      label: "Опросы",
      short: "Опросы",
      Icon: BarChart3,
      badge: livePoll ? "идёт" : String(parts.polls.polls.length),
      highlight: livePoll,
    },
    {
      key: "members",
      label: "Участники",
      short: "Участники",
      Icon: Users,
      badge: String(members.length),
    },
  ];
  if (hasBuildSection) {
    navItems.push({
      key: "build",
      label: "Материалы программы",
      short: "Материалы",
      Icon: LayoutTemplate,
    });
  }

  return (
    <div
      data-season={program.season}
      style={seasonStyle(program.season) as CSSProperties}
      className="bg-paper-warm py-8 md:py-10"
    >
      <div className="wrap pb-24 lg:pb-0">
        {/* ------------------------------------------------------ Верхняя строка */}
        <div className="mb-4 flex flex-wrap items-start justify-between gap-4 lg:mb-7 lg:gap-5">
          <div className="min-w-0">
            <Link
              href={`/programs/${program.slug}`}
              className="mb-2 inline-flex items-center gap-2 text-meta font-medium text-ink-soft no-underline transition-colors duration-200 hover:text-navy lg:mb-3"
            >
              <ArrowLeft size={14} />
              К странице программы
            </Link>
            <div className="flex flex-wrap items-center gap-3">
              <StatusChip status={program.status} />
              <span className="hidden text-micro font-semibold tracking-[0.16em] text-gold-ink uppercase sm:inline">
                {program.subtitle}
                {program.stream ? ` · ${program.stream}` : ""}
              </span>
            </div>
            <h1 className="m-0 mt-2.5 font-display text-[clamp(28px,4vw,44px)] leading-[1.02] font-semibold tracking-[-0.05em] text-navy">
              {program.title}
            </h1>
          </div>

          {/* На телефоне — одна строка, на широком экране — карточка */}
          <div
            className="flex w-full items-center gap-3 rounded-soft border border-[var(--line)] bg-white px-3.5 py-2.5 lg:block lg:w-auto lg:p-3.5"
            data-session-user={session.memberId}
            data-session-role={session.role}
          >
            <p className="m-0 mb-2.5 hidden text-micro font-semibold tracking-[0.12em] text-gold-ink uppercase lg:block">
              Вы вошли как
            </p>
            <p className="m-0 min-w-0 flex-1 truncate font-display text-ui font-semibold tracking-[-0.02em] text-navy lg:mb-1 lg:text-lead">
              {session.name}
            </p>
            <p className="m-0 mb-3 hidden text-caption text-ink-faint lg:block">
              {MEMBER_ROLE_LABELS[session.role]} программы
            </p>
            <div className="flex shrink-0 gap-2">
              {staff && (
                <Link
                  href={`/admin/programs/${program.slug}`}
                  className="inline-flex min-h-9 items-center gap-2 rounded-full bg-navy px-3.5 text-caption font-semibold text-white no-underline transition-all duration-200 ease-brand hover:-translate-y-0.5 hover:bg-navy-deep"
                >
                  <Settings size={13} />
                  <span className="hidden sm:inline">Управление</span>
                  <span className="sr-only sm:hidden">Управление</span>
                </Link>
              )}
              <form action={logoutAction}>
                <button
                  type="submit"
                  className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3.5 text-caption font-semibold text-navy transition-all duration-200 ease-brand hover:-translate-y-0.5"
                >
                  <LogOut size={13} />
                  <span className="hidden sm:inline">Выйти</span>
                  <span className="sr-only sm:hidden">Выйти</span>
                </button>
              </form>
            </div>
          </div>
        </div>

        {actionError && (
          <div
            role="alert"
            className="mb-4 flex flex-wrap items-center gap-3 rounded-2xl border border-autumn/40 bg-autumn/10 px-5 py-3.5 text-meta text-ink"
          >
            <span>Не удалось сохранить: {actionError}</span>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="ml-auto cursor-pointer font-semibold underline"
            >
              Понятно
            </button>
          </div>
        )}

        <div className="grid grid-cols-[minmax(0,1fr)] gap-4 lg:grid-cols-[280px_minmax(0,1fr)] lg:items-start lg:gap-6">
          <aside className="sticky top-24 z-10 hidden min-w-0 flex-col gap-4 lg:flex">
            <nav
              ref={navRef}
              className="card flex-col gap-1 p-3"
              aria-label="Разделы программы"
            >
              {navItems.map((item) => (
                <NavItem
                  key={item.key}
                  active={section === item.key}
                  onClick={() => openSection(item.key)}
                  icon={<item.Icon size={18} />}
                  label={item.label}
                  badge={item.badge}
                  highlight={item.highlight}
                />
              ))}
            </nav>

            <div className="card hidden gap-3.5 p-5 text-meta lg:flex">
              <p className="eyebrow mb-0">Программа</p>
              <ul className="m-0 grid list-none gap-3 p-0">
                <li className="flex items-start gap-2.5 text-ink-soft">
                  <CalendarDays size={15} className="mt-0.5 shrink-0 text-sky-ink" />
                  {program.dates}
                </li>
                <li className="flex items-start gap-2.5 text-ink-soft">
                  <MapPin size={15} className="mt-0.5 shrink-0 text-sky-ink" />
                  {program.location}
                </li>
                <li className="flex items-start gap-2.5 text-ink-soft">
                  <Users size={15} className="mt-0.5 shrink-0 text-sky-ink" />
                  {members.length} в рабочем пространстве
                </li>
              </ul>
            </div>
          </aside>

          <div className="min-w-0">
            {section === "channel" && (
              <Channel
                posts={posts}
                members={members}
                mentionNames={names}
                currentUser={currentUser}
                canPost={staff}
                canModerate={staff}
                onPublish={publish}
                {...handlers}
              />
            )}

            {section === "schedule" && (
              <section className="card p-6 md:p-8">
                <p className="eyebrow mb-2">Расписание</p>
                <h2 className="m-0 mb-6 font-display text-[clamp(24px,3vw,34px)] leading-tight font-semibold tracking-[-0.035em] text-navy">
                  Программа по дням
                </h2>
                {program.days.length ? (
                  <DaySchedule days={program.days} accent={season.accent} />
                ) : (
                  <p className="m-0 text-ui text-ink-soft">Расписание скоро появится.</p>
                )}
              </section>
            )}

            {section === "build" && <BuildView program={program} />}

            {section === "chats" && (
              <ChatView
                programSlug={program.slug}
                data={parts.chats}
                members={members}
                currentUser={currentUser}
                canManage={staff}
                mentionNames={names}
                onError={setActionError}
              />
            )}

            {section === "members" && (
              <MembersView members={members} declaredCount={program.participants} />
            )}

            {section === "polls" && (
              <PollsView
                programSlug={program.slug}
                programTitle={program.title}
                data={parts.polls}
                members={members}
                participantCount={Math.max(members.length - 1, 1)}
                currentUser={currentUser}
                canManage={staff}
                accent={season.accent}
                accentInk={season.ink}
              />
            )}
          </div>
        </div>
      </div>

      {/* Мобильное меню — вкладками внизу экрана, как в мессенджерах */}
      <nav
        data-hub-bottom-nav
        className="fixed inset-x-0 bottom-0 z-30 border-t border-[var(--line)] bg-white/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden"
        aria-label="Разделы программы"
      >
        <ul className="m-0 flex list-none items-stretch p-0">
          {navItems.map((item) => {
            const active = section === item.key;
            return (
              <li key={item.key} className="flex-1">
                <button
                  type="button"
                  onClick={() => openSection(item.key)}
                  aria-current={active ? "page" : undefined}
                  className="relative flex w-full cursor-pointer flex-col items-center gap-1 px-1 pt-2.5 pb-2 text-micro font-medium transition-colors"
                  style={active ? { color: "var(--accent-ink)" } : undefined}
                >
                  <span className="relative">
                    <item.Icon size={22} />
                    {item.highlight && (
                      <span
                        className="absolute -top-1 -right-2 size-2.5 rounded-full ring-2 ring-white"
                        style={{ background: "var(--accent)" }}
                        aria-hidden="true"
                      />
                    )}
                  </span>
                  <span className={active ? "font-semibold" : "text-ink-faint"}>{item.short}</span>
                </button>
              </li>
            );
          })}
        </ul>
      </nav>
    </div>
  );
}

/** Авторская сборка программы: загруженная в админке открывается здесь же. */
function BuildView({ program }: { program: HubProgram }) {
  if (program.hasBuild) {
    const src = `/programs/${program.slug}/build/index.html`;
    return (
      <section className="card overflow-hidden p-0">
        <div className="flex flex-wrap items-center gap-3 border-b border-[var(--line)] px-5 py-3.5">
          <p className="m-0 font-display text-lead font-semibold tracking-[-0.02em] text-navy">
            Сборка программы
          </p>
          <a
            href={src}
            target="_blank"
            rel="noopener"
            className="ml-auto inline-flex items-center gap-1.5 text-caption font-semibold text-navy"
          >
            Открыть на весь экран
            <ExternalLink size={13} />
          </a>
        </div>
        <iframe
          src={src}
          title={`Сборка программы «${program.title}»`}
          className="block h-[78vh] min-h-140 w-full border-0 bg-white"
        />
      </section>
    );
  }

  if (!program.landing) return null;

  return (
    <section className="card p-7">
      <p className="eyebrow mb-2">Сборка программы</p>
      <h2 className="m-0 mb-3 font-display text-[clamp(22px,2.6vw,30px)] leading-tight font-semibold tracking-[-0.035em] text-navy">
        Авторская страница программы
      </h2>
      <p className="m-0 mb-5 max-w-155 text-ui leading-relaxed text-ink-soft">
        Все материалы, записи и итоги программы собраны на отдельной странице.
        {program.landing.code ? " Для входа понадобится код доступа." : ""}
      </p>
      <div className="flex flex-wrap items-center gap-3">
        <a
          href={program.landing.url}
          target="_blank"
          rel="noopener noreferrer"
          className="inline-flex min-h-12 items-center gap-2 rounded-full bg-navy px-5.5 text-sm font-semibold text-white no-underline transition-all duration-200 ease-brand hover:-translate-y-0.5 hover:bg-navy-deep"
        >
          Открыть сборку
          <ExternalLink size={15} />
        </a>
        {program.landing.code && (
          <span className="rounded-full bg-sky-tint px-4 py-2 text-meta text-sky-ink">
            Код доступа: <b className="font-semibold tracking-[0.08em]">{program.landing.code}</b>
          </span>
        )}
      </div>
    </section>
  );
}

function NavItem({
  active = false,
  onClick,
  icon,
  label,
  badge,
  highlight = false,
}: {
  active?: boolean;
  onClick?: () => void;
  icon: ReactNode;
  label: string;
  badge?: string;
  highlight?: boolean;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-current={active ? "page" : undefined}
      className={[
        "flex shrink-0 cursor-pointer items-center gap-2.5 rounded-field px-3.5 py-2.5 text-left text-meta font-medium whitespace-nowrap transition-colors duration-200 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy",
        active ? "bg-navy text-white" : "text-ink-soft hover:bg-sky-tint hover:text-navy",
      ].join(" ")}
    >
      {icon}
      {label}
      {badge && (
        <span
          className={[
            "ml-auto rounded-full px-2 py-0.5 text-micro",
            active
              ? "bg-white/20 text-white"
              : highlight
                ? "bg-accent font-semibold text-black-ink"
                : "bg-sky-tint text-sky-ink",
          ].join(" ")}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
