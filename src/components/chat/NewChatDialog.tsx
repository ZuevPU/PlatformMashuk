"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, MessageSquarePlus, Search, Users, X } from "lucide-react";
import { Avatar, RoleBadge } from "@/components/hub/Avatar";
import type { Member } from "@/lib/types";
import { MAX_GROUP_MEMBERS } from "@/lib/types";

interface NewChatDialogProps {
  mode: "group" | "direct";
  members: Member[];
  currentUserId: string;
  onClose: () => void;
  onCreateGroup: (input: { title: string; topic?: string; memberIds: string[] }) => void;
  onOpenDirect: (memberId: string) => void;
}

/**
 * Создание группы по направлению или личного диалога.
 * Группа собирается из состава программы; личный диалог открывается сразу.
 */
export function NewChatDialog({
  mode,
  members,
  currentUserId,
  onClose,
  onCreateGroup,
  onOpenDirect,
}: NewChatDialogProps) {
  const [query, setQuery] = useState("");
  const [title, setTitle] = useState("");
  const [topic, setTopic] = useState("");
  const [selected, setSelected] = useState<string[]>([]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  const candidates = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return members
      .filter((member) => member.id !== currentUserId)
      .filter((member) =>
        needle
          ? [member.name, member.position, member.org, member.city]
              .filter(Boolean)
              .join(" ")
              .toLowerCase()
              .includes(needle)
          : true,
      );
  }, [currentUserId, members, query]);

  const toggle = (memberId: string) => {
    if (mode === "direct") {
      onOpenDirect(memberId);
      return;
    }
    setSelected((previous) =>
      previous.includes(memberId)
        ? previous.filter((id) => id !== memberId)
        : previous.length >= MAX_GROUP_MEMBERS - 1
          ? previous
          : [...previous, memberId],
    );
  };

  const canCreate = mode === "direct" ? false : title.trim().length > 0 && selected.length > 0;

  return (
    <div
      className="fixed inset-0 z-50 grid place-items-center overflow-auto bg-black-ink/45 p-5 backdrop-blur-[3px]"
      role="dialog"
      aria-modal="true"
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="w-full max-w-140 overflow-hidden rounded-card border border-[var(--line)] bg-white shadow-[0_32px_90px_rgba(10,16,20,0.24)]">
        <div className="mesh mesh--accent px-7 py-5">
          <div className="flex items-start justify-between gap-4">
            <div>
              <p className="eyebrow eyebrow--light mb-1.5">
                {mode === "group" ? "Новая группа" : "Новый диалог"}
              </p>
              <h2 className="m-0 font-display text-title leading-tight font-semibold tracking-[-0.03em] text-white">
                {mode === "group" ? "Чат по направлению" : "Личный диалог"}
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              aria-label="Закрыть"
              className="grid size-9 cursor-pointer place-items-center rounded-full bg-white/15 text-white transition-colors duration-200 hover:bg-white/25"
            >
              <X size={16} />
            </button>
          </div>
        </div>

        <div className="p-6">
          {mode === "group" && (
            <div className="mb-5 grid gap-3">
              <label className="flex flex-col gap-1.5">
                <span className="text-caption font-semibold tracking-[0.06em] text-ink-faint uppercase">
                  Название группы
                </span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Например: Трек «Работа с молодёжью»"
                  className="min-h-11 w-full rounded-field border border-[var(--line)] bg-white px-4 text-ui outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy focus:border-navy"
                />
              </label>
              <label className="flex flex-col gap-1.5">
                <span className="text-caption font-semibold tracking-[0.06em] text-ink-faint uppercase">
                  О чём группа
                </span>
                <input
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                  placeholder="Коротко: для чего собрались"
                  className="min-h-11 w-full rounded-field border border-[var(--line)] bg-white px-4 text-ui outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy focus:border-navy"
                />
              </label>
            </div>
          )}

          <label className="mb-3 flex items-center gap-2 rounded-full border border-[var(--line)] px-4">
            <Search size={15} className="text-ink-faint" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Имя, должность, город"
              aria-label="Поиск участников"
              className="min-h-11 w-full bg-transparent text-ui outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
            />
          </label>

          <div className="max-h-75 overflow-auto rounded-2xl border border-[var(--line)]">
            {candidates.map((member) => {
              const active = selected.includes(member.id);
              return (
                <button
                  key={member.id}
                  type="button"
                  onClick={() => toggle(member.id)}
                  className="flex w-full cursor-pointer items-center gap-3 border-b border-[var(--line)] px-4 py-3 text-left transition-colors duration-150 last:border-b-0 hover:bg-[var(--color-sky-tint)]"
                >
                  <Avatar member={member} size={38} />
                  <span className="min-w-0 flex-1">
                    <span className="mb-0.5 flex flex-wrap items-center gap-2">
                      <span className="text-ui font-medium text-ink">{member.name}</span>
                      <RoleBadge role={member.role} />
                    </span>
                    <span className="block text-caption text-ink-faint">
                      {[member.position, member.city].filter(Boolean).join(" · ")}
                    </span>
                  </span>
                  {mode === "group" ? (
                    <span
                      className={[
                        "grid size-7 shrink-0 place-items-center rounded-full border",
                        active
                          ? "border-transparent bg-navy text-white"
                          : "border-[var(--line)] text-transparent",
                      ].join(" ")}
                    >
                      <Check size={14} />
                    </span>
                  ) : (
                    <MessageSquarePlus size={16} className="shrink-0 text-ink-faint" />
                  )}
                </button>
              );
            })}

            {candidates.length === 0 && (
              <p className="m-0 px-4 py-6 text-center text-meta text-ink-faint">
                Никого не нашли — попробуйте другой запрос.
              </p>
            )}
          </div>

          {mode === "group" && (
            <div className="mt-5 flex flex-wrap items-center gap-3">
              <span className="inline-flex items-center gap-2 text-caption text-ink-faint">
                <Users size={14} />
                Выбрано: {selected.length}
              </span>
              <button
                type="button"
                disabled={!canCreate}
                onClick={() => onCreateGroup({ title, topic, memberIds: selected })}
                className="ml-auto inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-navy px-5 text-ui font-semibold text-white transition-all duration-200 ease-brand hover:bg-navy-deep disabled:cursor-not-allowed disabled:opacity-40"
              >
                Создать группу
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
