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
 * Расписание программы: табы по дням, как в авторских одностраничниках Центра.
 * Боковая панель дня оформлена фирменным mesh-фоном с сезонным свечением.
 */
export function DaySchedule({ days, accent }: DayScheduleProps) {
  const [active, setActive] = useState<number | "all">("all");

  const visible = active === "all" ? days : days.filter((day) => day.day === active);

  return (
    <div style={{ "--accent": accent } as CSSProperties}>
      <div className="mb-9 flex flex-wrap gap-2" role="tablist" aria-label="Фильтр по дням">
        <TabButton active={active === "all"} onClick={() => setActive("all")}>
          Все дни
        </TabButton>
        {days.map((day) => (
          <TabButton
            key={day.day}
            active={active === day.day}
            onClick={() => setActive(day.day)}
          >
            День {day.day}
          </TabButton>
        ))}
      </div>

      <div className="grid gap-4">
        {visible.map((day) => (
          <article
            key={day.day}
            className="grid overflow-hidden rounded-[26px] border border-[var(--line)] bg-white shadow-[var(--shadow-soft)] md:grid-cols-[205px_1fr]"
          >
            <div className="mesh mesh--accent p-7">
              <b className="mb-2.5 block font-display text-[29px] font-semibold tracking-[-0.03em] text-white">
                День {day.day}
              </b>
              <span className="text-[13px] leading-snug text-sky-light">
                {formatDayMonth(day.date)}
                <br />
                {day.theme}
              </span>
            </div>

            <div className="px-5 py-3 md:px-7">
              {day.slots.map((slot, index) => (
                <div
                  key={`${day.day}-${slot.time}-${index}`}
                  className="grid grid-cols-[72px_1fr] items-start gap-x-4 gap-y-2 border-b border-[var(--line)] py-5 last:border-b-0 md:grid-cols-[92px_1fr_auto] md:gap-[18px]"
                >
                  <time className="pt-0.5 text-[13px] font-semibold text-gold">
                    {slot.time}
                  </time>
                  <div>
                    <h3 className="m-0 mb-1.5 font-display text-[17px] leading-snug font-semibold text-navy">
                      {slot.title}
                    </h3>
                    {slot.speakers && slot.speakers.length > 0 && (
                      <p className="m-0 text-[13px] leading-normal text-ink-muted">
                        {slot.speakers.join(" · ")}
                      </p>
                    )}
                    {slot.description && (
                      <p className="m-0 mt-1 text-[13px] leading-normal text-ink-faint">
                        {slot.description}
                      </p>
                    )}
                  </div>
                  {slot.tag && <span className="tag col-start-2 md:col-start-3">{slot.tag}</span>}
                </div>
              ))}
            </div>
          </article>
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
        "min-h-10 cursor-pointer rounded-full border px-4 text-[13px] font-semibold transition-all duration-200 ease-brand",
        active
          ? "border-navy bg-navy text-white"
          : "border-[var(--line)] bg-white text-navy hover:-translate-y-0.5",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
