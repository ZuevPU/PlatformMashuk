"use client";

import { useState } from "react";
import type { CSSProperties, ReactNode } from "react";
import { formatDayMonth } from "@/lib/dates";
import type { ProgramDay } from "@/lib/types";

interface DayScheduleProps {
  days: ProgramDay[];
  accent: string;
}

/**
 * Расписание программы — компактной таблицей по дням: меньше пустого места
 * и прокрутки, видно время, блок, спикеров и метку блока сразу.
 */
export function DaySchedule({ days, accent }: DayScheduleProps) {
  const [active, setActive] = useState<number | "all">("all");
  const visible = active === "all" ? days : days.filter((day) => day.day === active);

  return (
    <div style={{ "--accent": accent } as CSSProperties}>
      <div className="mb-6 flex flex-wrap gap-2" role="tablist" aria-label="Фильтр по дням">
        <TabButton active={active === "all"} onClick={() => setActive("all")}>
          Все дни
        </TabButton>
        {days.map((day) => (
          <TabButton key={day.day} active={active === day.day} onClick={() => setActive(day.day)}>
            День {day.day}
          </TabButton>
        ))}
      </div>

      <div className="flex flex-col gap-5">
        {visible.map((day) => (
          <section
            key={day.day}
            className="overflow-hidden rounded-2xl border border-[var(--line)] bg-white"
          >
            <header className="flex flex-wrap items-baseline gap-x-4 gap-y-1 border-b border-[var(--line)] bg-sky-pale px-4 py-2.5">
              <span className="font-display text-body font-semibold tracking-[-0.02em] text-navy">
                День {day.day}
              </span>
              <span className="text-meta text-ink-soft">{formatDayMonth(day.date)}</span>
              <span className="text-meta text-ink-faint">{day.theme}</span>
            </header>

            <table className="w-full border-collapse text-meta">
              <tbody>
                {day.slots.map((slot, index) => (
                  <tr
                    key={`${day.day}-${slot.time}-${index}`}
                    className="border-b border-[var(--line)] align-top last:border-b-0"
                  >
                    <td className="w-20 px-4 py-3 font-semibold whitespace-nowrap text-gold-ink">
                      {slot.time}
                    </td>
                    <td className="px-2 py-3">
                      <span className="font-medium text-navy">{slot.title}</span>
                      {slot.speakers && slot.speakers.length > 0 && (
                        <span className="text-ink-muted"> · {slot.speakers.join(", ")}</span>
                      )}
                      {slot.description && (
                        <div className="mt-0.5 text-ink-faint">{slot.description}</div>
                      )}
                    </td>
                    <td className="w-px px-4 py-3 align-top">
                      {slot.tag && <span className="tag whitespace-nowrap">{slot.tag}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ))}
      </div>
    </div>
  );
}

function TabButton({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: ReactNode;
}) {
  return (
    <button
      type="button"
      role="tab"
      aria-selected={active}
      onClick={onClick}
      className={[
        "min-h-9 cursor-pointer rounded-full border px-3.5 text-meta font-semibold transition-all duration-200 ease-brand",
        active
          ? "border-navy bg-navy text-white"
          : "border-[var(--line)] bg-white text-navy hover:-translate-y-0.5",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
