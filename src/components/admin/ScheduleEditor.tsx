"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Plus, Trash2 } from "lucide-react";
import { saveScheduleAction } from "@/lib/admin-actions";
import type { AdminState } from "@/lib/admin-actions";
import type { ProgramDay, Slot } from "@/lib/types";
import { Button, Result, inputClass } from "./ui";

/**
 * Редактор расписания: дни — лентой, внутри дня — время слева и события справа,
 * как участник видит программу. Порядок событий меняется стрелками.
 */

interface DraftSlot extends Slot {
  key: string;
}

interface DraftDay {
  key: string;
  date: string;
  theme: string;
  slots: DraftSlot[];
}

let counter = 0;
const key = () => `k${++counter}`;

function toDraft(days: ProgramDay[]): DraftDay[] {
  return days.map((day) => ({
    key: key(),
    date: day.date.slice(0, 10),
    theme: day.theme,
    slots: day.slots.map((slot) => ({ ...slot, key: key() })),
  }));
}

function nextDate(date: string | undefined, fallback: string): string {
  if (!date) return fallback;
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + 1);
  return value.toISOString().slice(0, 10);
}

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function ScheduleEditor({
  slug,
  days: initial,
  startDate,
}: {
  slug: string;
  days: ProgramDay[];
  startDate: string;
}) {
  const [days, setDays] = useState<DraftDay[]>(() => toDraft(initial));
  const [dirty, setDirty] = useState(false);
  const [state, setState] = useState<AdminState>({});
  const [pending, startTransition] = useTransition();

  const update = (updater: (days: DraftDay[]) => DraftDay[]) => {
    setDays(updater);
    setDirty(true);
    setState({});
  };

  const updateDay = (dayKey: string, patch: Partial<DraftDay>) =>
    update((list) => list.map((day) => (day.key === dayKey ? { ...day, ...patch } : day)));

  const updateSlot = (dayKey: string, slotKey: string, patch: Partial<DraftSlot>) =>
    update((list) =>
      list.map((day) =>
        day.key === dayKey
          ? { ...day, slots: day.slots.map((slot) => (slot.key === slotKey ? { ...slot, ...patch } : slot)) }
          : day,
      ),
    );

  const save = () =>
    startTransition(async () => {
      const result = await saveScheduleAction({
        slug,
        days: days.map((day, index) => ({
          day: index + 1,
          date: day.date,
          theme: day.theme,
          slots: day.slots.map(({ key: _key, ...slot }) => slot),
        })),
      });
      setState(result);
      if (!result.error) setDirty(false);
    });

  return (
    <div className="flex flex-col gap-6">
      {days.length === 0 && (
        <p className="m-0 rounded-2xl bg-sky-tint px-5 py-4 text-ui text-sky-ink">
          Расписания пока нет. Добавьте первый день — участники увидят его в разделе «Расписание».
        </p>
      )}

      <ol className="m-0 flex list-none flex-col gap-6 p-0">
        {days.map((day, dayIndex) => (
          <li key={day.key} className="rounded-panel border border-[var(--line)] bg-paper-warm p-4 md:p-5">
            <div className="mb-4 flex flex-wrap items-end gap-3">
              <span className="font-display text-heading leading-none font-semibold tracking-[-0.05em] text-navy">
                День {dayIndex + 1}
              </span>
              <label className="flex flex-col gap-1">
                <span className="sr-only">Дата дня {dayIndex + 1}</span>
                <input
                  type="date"
                  value={day.date}
                  onChange={(event) => updateDay(day.key, { date: event.target.value })}
                  className={`${inputClass} min-h-10 w-42`}
                />
              </label>
              <label className="flex min-w-55 flex-1 flex-col gap-1">
                <span className="sr-only">Тема дня {dayIndex + 1}</span>
                <input
                  value={day.theme}
                  onChange={(event) => updateDay(day.key, { theme: event.target.value })}
                  placeholder="Тема дня"
                  className={`${inputClass} min-h-10`}
                />
              </label>
              <div className="flex gap-1.5">
                <IconButton
                  label="Поднять день выше"
                  onClick={() => update((list) => move(list, dayIndex, dayIndex - 1))}
                  disabled={dayIndex === 0}
                >
                  <ArrowUp size={14} />
                </IconButton>
                <IconButton
                  label="Опустить день ниже"
                  onClick={() => update((list) => move(list, dayIndex, dayIndex + 1))}
                  disabled={dayIndex === days.length - 1}
                >
                  <ArrowDown size={14} />
                </IconButton>
                <IconButton
                  label={`Удалить день ${dayIndex + 1}`}
                  onClick={() => {
                    if (day.slots.length === 0 || confirm(`Удалить день ${dayIndex + 1} со всеми событиями?`)) {
                      update((list) => list.filter((item) => item.key !== day.key));
                    }
                  }}
                >
                  <Trash2 size={14} />
                </IconButton>
              </div>
            </div>

            {/* Лента дня: время слева, события справа */}
            <ul className="m-0 flex list-none flex-col p-0">
              {day.slots.map((slot, slotIndex) => (
                <li
                  key={slot.key}
                  className="grid grid-cols-[76px_minmax(0,1fr)] gap-x-3 border-l-2 border-accent/60 py-2 pl-3 md:grid-cols-[92px_minmax(0,1fr)_auto]"
                >
                  <input
                    aria-label="Время"
                    value={slot.time}
                    onChange={(event) => updateSlot(day.key, slot.key, { time: event.target.value })}
                    placeholder="10:00"
                    className={`${inputClass} min-h-10 self-start px-2.5 font-semibold text-navy tabular-nums`}
                  />
                  <div className="flex min-w-0 flex-col gap-2">
                    <input
                      aria-label="Событие"
                      value={slot.title}
                      onChange={(event) => updateSlot(day.key, slot.key, { title: event.target.value })}
                      placeholder="Что происходит"
                      className={`${inputClass} min-h-10 font-medium`}
                    />
                    <div className="grid gap-2 sm:grid-cols-[minmax(0,1fr)_140px]">
                      <input
                        aria-label="Спикеры"
                        value={(slot.speakers ?? []).join(", ")}
                        onChange={(event) =>
                          updateSlot(day.key, slot.key, {
                            speakers: event.target.value.split(",").map((name) => name.trimStart()),
                          })
                        }
                        placeholder="Спикеры через запятую"
                        className={`${inputClass} min-h-9 text-meta`}
                      />
                      <input
                        aria-label="Метка"
                        value={slot.tag ?? ""}
                        onChange={(event) => updateSlot(day.key, slot.key, { tag: event.target.value })}
                        placeholder="Метка: лекция"
                        className={`${inputClass} min-h-9 text-meta`}
                      />
                    </div>
                    <textarea
                      aria-label="Описание"
                      value={slot.description ?? ""}
                      onChange={(event) => updateSlot(day.key, slot.key, { description: event.target.value })}
                      placeholder="Описание — по желанию"
                      rows={1}
                      className={`${inputClass} min-h-9 py-2 text-meta leading-snug`}
                    />
                  </div>
                  <div className="col-start-2 flex gap-1.5 md:col-start-auto md:flex-col">
                    <IconButton
                      label="Раньше"
                      onClick={() =>
                        updateDay(day.key, { slots: move(day.slots, slotIndex, slotIndex - 1) })
                      }
                      disabled={slotIndex === 0}
                    >
                      <ArrowUp size={13} />
                    </IconButton>
                    <IconButton
                      label="Позже"
                      onClick={() =>
                        updateDay(day.key, { slots: move(day.slots, slotIndex, slotIndex + 1) })
                      }
                      disabled={slotIndex === day.slots.length - 1}
                    >
                      <ArrowDown size={13} />
                    </IconButton>
                    <IconButton
                      label="Удалить событие"
                      onClick={() =>
                        updateDay(day.key, { slots: day.slots.filter((item) => item.key !== slot.key) })
                      }
                    >
                      <Trash2 size={13} />
                    </IconButton>
                  </div>
                </li>
              ))}
            </ul>

            <Button
              tone="quiet"
              size="sm"
              className="mt-3"
              onClick={() =>
                updateDay(day.key, {
                  slots: [...day.slots, { key: key(), time: "", title: "", speakers: [] }],
                })
              }
            >
              <Plus size={13} />
              Добавить событие
            </Button>
          </li>
        ))}
      </ol>

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-soft border border-[var(--line)] bg-white/95 p-3 shadow-[var(--shadow-brand)] backdrop-blur">
        <Button
          tone="quiet"
          onClick={() =>
            update((list) => [
              ...list,
              {
                key: key(),
                date: nextDate(list.at(-1)?.date, startDate),
                theme: "",
                slots: [],
              },
            ])
          }
        >
          <Plus size={15} />
          Добавить день
        </Button>
        <Button onClick={save} disabled={pending || !dirty}>
          {pending ? "Сохраняем…" : dirty ? "Сохранить расписание" : "Сохранено"}
        </Button>
        <Result state={state} />
      </div>
    </div>
  );
}

export function IconButton({
  label,
  onClick,
  disabled,
  children,
}: {
  label: string;
  onClick: () => void;
  disabled?: boolean;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      disabled={disabled}
      className="grid size-9 cursor-pointer place-items-center rounded-full bg-white text-ink-soft shadow-[inset_0_0_0_1px_var(--line)] transition-colors duration-150 hover:text-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:cursor-default disabled:opacity-30"
    >
      {children}
    </button>
  );
}
