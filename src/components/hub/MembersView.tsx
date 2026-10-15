"use client";

import { useMemo, useState } from "react";
import { Search } from "lucide-react";
import { Avatar, RoleBadge } from "./Avatar";
import type { Member, MemberRole } from "@/lib/types";

const GROUPS: MemberRole[] = ["admin", "moderator", "participant"];

const GROUP_TITLES: Record<MemberRole, string> = {
  admin: "Администраторы",
  moderator: "Модераторы",
  participant: "Участники",
};

export function MembersView({
  members,
  declaredCount,
}: {
  members: Member[];
  declaredCount?: number;
}) {
  const [query, setQuery] = useState("");

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((member) =>
      [member.name, member.position, member.org, member.city]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [members, query]);

  return (
    <div className="flex flex-col gap-5">
      <section className="card p-7">
        <p className="eyebrow mb-2">Участники программы</p>
        <h2 className="m-0 mb-4 font-display text-[clamp(24px,3vw,32px)] leading-tight font-semibold tracking-[-0.035em] text-navy">
          Кто в программе
        </h2>
        <label className="flex max-w-105 items-center gap-2 rounded-full border border-[var(--line)] bg-white px-4">
          <Search size={15} className="text-ink-faint" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Имя, должность, город"
            aria-label="Поиск участников"
            className="min-h-11 w-full bg-transparent text-sm outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
          />
        </label>
        {declaredCount ? (
          <p className="m-0 mt-4 max-w-140 text-meta leading-relaxed text-ink-faint">
            В программе заявлено {declaredCount}{" "}
            {declaredCount === 1 ? "участник" : declaredCount < 5 ? "участника" : "участников"}.
            В демонстрационном составе показаны {members.length} — реальный список подтянется
            из базы вместе с персональными приглашениями.
          </p>
        ) : null}
      </section>

      {GROUPS.map((role) => {
        const group = filtered.filter((member) => member.role === role);
        if (group.length === 0) return null;

        return (
          <section key={role} className="card p-7">
            <div className="mb-5 flex flex-wrap items-center gap-3">
              <h3 className="m-0 font-display text-subtitle font-semibold tracking-[-0.02em] text-navy">
                {GROUP_TITLES[role]}
              </h3>
              <span className="tag">{group.length}</span>
            </div>

            <ul className="m-0 grid list-none gap-3 p-0 md:grid-cols-2">
              {group.map((member) => (
                <li
                  key={member.id}
                  className="flex items-center gap-3.5 rounded-2xl border border-[var(--line)] p-4"
                >
                  <Avatar member={member} size={44} />
                  <div className="min-w-0">
                    <div className="mb-1 flex flex-wrap items-center gap-2">
                      <span className="text-ui font-semibold text-ink">{member.name}</span>
                      <RoleBadge role={member.role} />
                    </div>
                    <p className="m-0 text-caption leading-snug text-ink-soft">
                      {[member.position, member.org, member.city].filter(Boolean).join(" · ")}
                    </p>
                  </div>
                </li>
              ))}
            </ul>
          </section>
        );
      })}

      {filtered.length === 0 && (
        <section className="card p-7">
          <p className="m-0 text-sm text-ink-soft">
            Никого не нашли. Попробуйте изменить запрос.
          </p>
        </section>
      )}
    </div>
  );
}
