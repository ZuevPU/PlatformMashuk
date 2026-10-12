"use client";

import { useMemo, useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ArrowLeft,
  BarChart3,
  CalendarDays,
  FileText,
  LogOut,
  MessagesSquare,
  MapPin,
  Users,
} from "lucide-react";
import { Channel } from "./Channel";
import type { ComposerPayload } from "./Composer";
import { MembersView } from "./MembersView";
import { ChatView } from "@/components/chat/ChatView";
import { PollsView } from "@/components/polls/PollsView";
import {
  addCommentAction,
  createPostAction,
  toggleCommentReactionAction,
  togglePinAction,
  togglePostReactionAction,
} from "@/app/programs/[slug]/hub/actions";
import { StatusChip } from "@/components/programs/StatusChip";
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
import { visibleConversations } from "@/lib/chat-actions";
import { localIsoNow } from "@/lib/dates";
import { SEASONS } from "@/lib/brand";
import type {
  ChatData,
  HubData,
  Member,
  MemberRole,
  PollData,
  Post,
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
  postsCount: number;
}

type Section = "channel" | "chats" | "members" | "polls";

const ROLE_TABS: { key: MemberRole; label: string }[] = [
  { key: "admin", label: "Администратор" },
  { key: "moderator", label: "Модератор" },
  { key: "participant", label: "Участник" },
];

export interface HubSession {
  memberId: string;
  name: string;
  role: MemberRole;
}

export function HubApp({
  program,
  hub,
  polls,
  chat,
  session = null,
  initialSection = "channel",
}: {
  program: HubProgram;
  hub: HubData;
  polls: PollData;
  chat: ChatData;
  session?: HubSession | null;
  initialSection?: Section;
}) {
  const router = useRouter();
  const [role, setRole] = useState<MemberRole>(session?.role ?? "moderator");
  const [section, setSection] = useState<Section>(initialSection);
  const [posts, setPosts] = useState<Post[]>(hub.posts);
  const [actionError, setActionError] = useState<string | null>(null);

  /** Запись в базу доступна только вошедшему участнику */
  const persist = Boolean(session);

  const openSection = (next: Section) => {
    setSection(next);
    // Ссылку на раздел можно переслать: /hub?tab=members
    router.replace(next === "channel" ? "?" : `?tab=${next}`, { scroll: false });
  };

  const season = SEASONS[program.season];

  const currentUser = useMemo<Member>(() => {
    if (session) {
      const known = hub.members.find((member) => member.id === session.memberId);
      if (known) return known;
      return { id: session.memberId, name: session.name, role: session.role };
    }
    const byRole = hub.members.find((member) => member.role === role);
    if (byRole) return byRole;
    return hub.members.find((member) => member.id === hub.currentUserId) ?? hub.members[0];
  }, [hub.currentUserId, hub.members, role, session]);

  const names = useMemo(() => buildMentionNames(hub.members), [hub.members]);

  const canPost = role === "admin" || role === "moderator";
  const canModerate = canPost;
  const effectiveRole = session?.role ?? role;

  const publish = (payload: ComposerPayload) => {
    setPosts((previous) =>
      sortPosts([
        createPost({
          programSlug: program.slug,
          authorId: currentUser.id,
          title: payload.title,
          body: payload.body,
          attachments: payload.attachments,
          createdAt: localIsoNow(),
        }),
        ...previous,
      ]),
    );

    // Интерфейс обновляется сразу, запись уходит в базу следом
    if (persist) {
      void createPostAction({
        programSlug: program.slug,
        title: payload.title,
        body: payload.body,
        attachments: payload.attachments,
      }).then((result) => {
        if (!result.ok) setActionError(result.error);
      });
    }
  };

  const handlers = {
    onToggleReaction: (postId: string, emoji: string) => {
      setPosts((previous) => togglePostReaction(previous, postId, emoji));
      if (persist) {
        void togglePostReactionAction({ programSlug: program.slug, postId, emoji });
      }
    },
    onToggleCommentReaction: (postId: string, commentId: string, emoji: string) => {
      setPosts((previous) => toggleCommentReaction(previous, postId, commentId, emoji));
      if (persist) {
        void toggleCommentReactionAction({ programSlug: program.slug, commentId, emoji });
      }
    },
    onTogglePin: (postId: string) => {
      const target = posts.find((post) => post.id === postId);
      setPosts((previous) => sortPosts(togglePinned(previous, postId)));
      if (persist && target) {
        void togglePinAction({ programSlug: program.slug, postId, pinned: !target.pinned });
      }
    },
    onAddComment: (postId: string, payload: ComposerPayload) => {
      setPosts((previous) =>
        addComment(
          previous,
          postId,
          createComment({ authorId: currentUser.id, body: payload.body, createdAt: localIsoNow() }),
        ),
      );
      if (persist) {
        void addCommentAction({ programSlug: program.slug, postId, body: payload.body }).then(
          (result) => {
            if (!result.ok) setActionError(result.error);
          },
        );
      }
    },
    onAddReply: (postId: string, commentId: string, payload: ComposerPayload) => {
      setPosts((previous) =>
        addReply(
          previous,
          postId,
          commentId,
          createComment({ authorId: currentUser.id, body: payload.body, createdAt: localIsoNow() }),
        ),
      );
      if (persist) {
        void addCommentAction({
          programSlug: program.slug,
          postId,
          parentId: commentId,
          body: payload.body,
        });
      }
    },
  };

  return (
    <div
      data-season={program.season}
      style={
        {
          "--accent": season.accent,
          "--accent-strong": season.strong,
        } as CSSProperties
      }
      className="bg-paper-warm py-8 md:py-10"
    >
      <div className="wrap">
        {/* ------------------------------------------------------ Верхняя строка */}
        <div className="mb-7 flex flex-wrap items-start justify-between gap-5">
          <div className="min-w-0">
            <Link
              href={`/programs/${program.slug}`}
              className="mb-3 inline-flex items-center gap-2 text-[13px] font-medium text-ink-soft no-underline transition-colors duration-200 hover:text-navy"
            >
              <ArrowLeft size={14} />
              К странице программы
            </Link>

            <div className="flex flex-wrap items-center gap-3">
              <StatusChip status={program.status} />
              <span className="text-[11px] font-semibold tracking-[0.16em] text-gold uppercase">
                {program.subtitle}
                {program.stream ? ` · ${program.stream}` : ""}
              </span>
              <span className="rounded-full bg-white px-2.5 py-1 text-[10px] font-semibold tracking-[0.08em] text-ink-faint uppercase shadow-[inset_0_0_0_1px_var(--line)]">
                Демо-данные
              </span>
            </div>

            <h1 className="m-0 mt-2.5 font-display text-[clamp(28px,4vw,44px)] leading-[1.02] font-semibold tracking-[-0.05em] text-navy">
              {program.title}
            </h1>
          </div>

          {/* Сессия: если участник вошёл по приглашению, роль берётся из неё */}
          <div
            className="rounded-[18px] border border-[var(--line)] bg-white p-3.5"
            data-session-user={session?.memberId ?? ""}
            data-session-role={session ? session.role : ""}
          >
            {session ? (
              <>
                <p className="m-0 mb-2.5 text-[11px] font-semibold tracking-[0.12em] text-gold uppercase">
                  Вы вошли как
                </p>
                <p className="m-0 mb-1 font-display text-[16px] font-semibold tracking-[-0.02em] text-navy">
                  {session.name}
                </p>
                <p className="m-0 mb-3 text-[12px] text-ink-faint">
                  {MEMBER_ROLE_LABELS[effectiveRole]} программы
                </p>
                <form action="/api/auth/logout" method="post">
                  <button
                    type="submit"
                    className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border border-[var(--line)] bg-white px-3.5 text-[12px] font-semibold text-navy transition-all duration-200 ease-brand hover:-translate-y-0.5"
                  >
                    <LogOut size={13} />
                    Выйти
                  </button>
                </form>
              </>
            ) : (
              <>
                <p className="m-0 mb-2.5 text-[11px] font-semibold tracking-[0.12em] text-gold uppercase">
                  Смотреть как
                </p>
                <div className="flex flex-wrap gap-1.5">
                  {ROLE_TABS.map((tab) => (
                    <button
                      key={tab.key}
                      type="button"
                      onClick={() => setRole(tab.key)}
                      className={[
                        "min-h-9 cursor-pointer rounded-full border px-3.5 text-[12px] font-semibold transition-all duration-200 ease-brand",
                        role === tab.key
                          ? "border-navy bg-navy text-white"
                          : "border-[var(--line)] bg-white text-navy hover:-translate-y-0.5",
                      ].join(" ")}
                    >
                      {tab.label}
                    </button>
                  ))}
                </div>
                <p className="m-0 mt-2.5 max-w-[260px] text-[11px] leading-snug text-ink-faint">
                  Демонстрационный режим. Вы вошли как{" "}
                  <b className="text-ink-soft">{currentUser.name}</b> — после подключения базы
                  роль берётся из приглашения.
                </p>
              </>
            )}
          </div>
        </div>

        {/* ------------------------------------------------------------- Сетка */}
        {actionError && (
          <div className="mb-4 flex flex-wrap items-center gap-3 rounded-[16px] border border-[#F24559]/40 bg-[#FDE9EC] px-5 py-3.5 text-[13px] text-[#8C2430]">
            <span>Не удалось сохранить в базу: {actionError}</span>
            <button
              type="button"
              onClick={() => setActionError(null)}
              className="ml-auto cursor-pointer font-semibold underline"
            >
              Понятно
            </button>
          </div>
        )}

        <div className="grid gap-6 lg:grid-cols-[280px_1fr] lg:items-start">
          <aside className="flex flex-col gap-4 lg:sticky lg:top-[96px]">
            <nav className="card gap-1 p-3" aria-label="Разделы программы">
              <NavItem
                active={section === "channel"}
                onClick={() => openSection("channel")}
                icon={<MessagesSquare size={16} />}
                label="Канал программы"
                badge={String(posts.length)}
              />
              <NavItem
                active={section === "chats"}
                onClick={() => openSection("chats")}
                icon={<MessagesSquare size={16} />}
                label="Чаты"
                badge={String(visibleConversations(chat.conversations, currentUser.id).length)}
              />
              <NavItem
                active={section === "members"}
                onClick={() => openSection("members")}
                icon={<Users size={16} />}
                label="Участники"
                badge={String(hub.members.length)}
              />
              <NavItem
                active={section === "polls"}
                onClick={() => openSection("polls")}
                icon={<BarChart3 size={16} />}
                label="Опросы и квизы"
                badge={String(polls.polls.length)}
              />
              <Link
                href={`/programs/${program.slug}#materials`}
                className="flex items-center gap-2.5 rounded-[14px] px-3.5 py-2.5 text-[13px] font-medium text-ink-soft no-underline transition-colors duration-200 hover:bg-sky-tint hover:text-navy"
              >
                <FileText size={16} />
                Материалы программы
                <span className="ml-auto text-[11px] text-ink-faint">
                  {program.materialsCount}
                </span>
              </Link>
            </nav>

            <div className="card gap-3.5 p-5 text-[13px]">
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
                  {program.participants ? `${program.participants} участников` : "состав формируется"}
                </li>
              </ul>
            </div>
          </aside>

          <div className="min-w-0">
            {section === "channel" && (
              <Channel
                posts={posts}
                members={hub.members}
                mentionNames={names}
                currentUser={currentUser}
                canPost={canPost}
                canModerate={canModerate}
                onPublish={publish}
                {...handlers}
              />
            )}

            {section === "chats" && (
              <ChatView
                programSlug={program.slug}
                data={chat}
                members={hub.members}
                currentUser={currentUser}
                canManage={canModerate}
                mentionNames={names}
                persist={persist}
              />
            )}

            {section === "members" && (
              <MembersView members={hub.members} declaredCount={program.participants} />
            )}

            {section === "polls" && (
              <PollsView
                programSlug={program.slug}
                programTitle={program.title}
                data={polls}
                members={hub.members}
                participantCount={program.participants ?? hub.members.length}
                currentUser={currentUser}
                canManage={canModerate}
                accent={season.accent}
                persist={persist}
              />
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function NavItem({
  active = false,
  disabled = false,
  onClick,
  icon,
  label,
  badge,
}: {
  active?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  icon: ReactNode;
  label: string;
  badge?: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "flex items-center gap-2.5 rounded-[14px] px-3.5 py-2.5 text-left text-[13px] font-medium transition-colors duration-200",
        disabled
          ? "cursor-not-allowed text-ink-faint opacity-70"
          : "cursor-pointer hover:bg-sky-tint hover:text-navy",
        active ? "bg-navy text-white hover:bg-navy hover:text-white" : "text-ink-soft",
      ].join(" ")}
    >
      {icon}
      {label}
      {badge && (
        <span
          className={[
            "ml-auto rounded-full px-2 py-0.5 text-[11px]",
            active ? "bg-white/20 text-white" : "bg-[var(--color-sky-tint)] text-sky-ink",
          ].join(" ")}
        >
          {badge}
        </span>
      )}
    </button>
  );
}
