"use client";

import { useState, useTransition } from "react";
import { ArrowDown, ArrowUp, Link2, Plus, Trash2 } from "lucide-react";
import { saveMaterialsAction } from "@/lib/admin-actions";
import type { AdminState } from "@/lib/admin-actions";
import type { ProgramMaterial } from "@/lib/types";
import { Button, Result, inputClass } from "./ui";
import { IconButton } from "./ScheduleEditor";

/**
 * Материалы программы по дням: презентации, записи, тексты — ссылками.
 * Файлы лежат в общей папке или в сборке программы, здесь — навигация по ним.
 */

interface Draft extends ProgramMaterial {
  key: string;
}

let counter = 0;
const key = () => `m${++counter}`;

function move<T>(list: T[], from: number, to: number): T[] {
  if (to < 0 || to >= list.length) return list;
  const next = [...list];
  const [item] = next.splice(from, 1);
  next.splice(to, 0, item);
  return next;
}

export function MaterialsEditor({
  slug,
  materials: initial,
  dayCount,
}: {
  slug: string;
  materials: ProgramMaterial[];
  dayCount: number;
}) {
  const [items, setItems] = useState<Draft[]>(() => initial.map((item) => ({ ...item, key: key() })));
  const [dirty, setDirty] = useState(false);
  const [state, setState] = useState<AdminState>({});
  const [pending, startTransition] = useTransition();

  const update = (updater: (items: Draft[]) => Draft[]) => {
    setItems(updater);
    setDirty(true);
    setState({});
  };
  const patch = (itemKey: string, value: Partial<Draft>) =>
    update((list) => list.map((item) => (item.key === itemKey ? { ...item, ...value } : item)));

  const save = () =>
    startTransition(async () => {
      const result = await saveMaterialsAction({
        slug,
        materials: items.map(({ key: _key, ...item }) => item),
      });
      setState(result);
      if (!result.error) setDirty(false);
    });

  const days = Math.max(dayCount, 1, ...items.map((item) => item.day));

  return (
    <div className="flex flex-col gap-4">
      {items.length === 0 && (
        <p className="m-0 rounded-2xl bg-sky-tint px-5 py-4 text-ui text-sky-ink">
          Материалов пока нет. Добавьте блок — например, презентацию лекции первого дня.
        </p>
      )}

      {items.map((item, index) => (
        <article
          key={item.key}
          className="grid gap-3 rounded-soft border border-[var(--line)] bg-paper-warm p-4 md:grid-cols-[120px_minmax(0,1fr)_auto]"
        >
          <div className="flex flex-col gap-2">
            <select
              aria-label="День"
              value={item.day}
              onChange={(event) => patch(item.key, { day: Number(event.target.value) })}
              className={`${inputClass} min-h-10 cursor-pointer`}
            >
              {Array.from({ length: days }, (_, day) => (
                <option key={day + 1} value={day + 1}>
                  День {day + 1}
                </option>
              ))}
            </select>
            <input
              aria-label="Тип"
              value={item.kind}
              onChange={(event) => patch(item.key, { kind: event.target.value })}
              placeholder="Лекция"
              className={`${inputClass} min-h-10 text-meta`}
            />
          </div>

          <div className="flex min-w-0 flex-col gap-2">
            <input
              aria-label="Название"
              value={item.title}
              onChange={(event) => patch(item.key, { title: event.target.value })}
              placeholder="Название материала"
              className={`${inputClass} min-h-10 font-medium`}
            />
            <input
              aria-label="Спикеры"
              value={(item.speakers ?? []).join(", ")}
              onChange={(event) =>
                patch(item.key, { speakers: event.target.value.split(",").map((name) => name.trimStart()) })
              }
              placeholder="Спикеры через запятую"
              className={`${inputClass} min-h-9 text-meta`}
            />
            <textarea
              aria-label="Описание"
              value={item.description ?? ""}
              onChange={(event) => patch(item.key, { description: event.target.value })}
              placeholder="Коротко о материале — по желанию"
              rows={2}
              className={`${inputClass} py-2 text-meta leading-snug`}
            />

            <ul className="m-0 flex list-none flex-col gap-2 p-0">
              {item.links.map((link, linkIndex) => (
                <li key={linkIndex} className="grid grid-cols-[minmax(0,140px)_minmax(0,1fr)_auto] gap-2">
                  <input
                    aria-label="Подпись ссылки"
                    value={link.label}
                    onChange={(event) =>
                      patch(item.key, {
                        links: item.links.map((current, i) =>
                          i === linkIndex ? { ...current, label: event.target.value } : current,
                        ),
                      })
                    }
                    placeholder="Презентация"
                    className={`${inputClass} min-h-9 text-meta`}
                  />
                  <input
                    aria-label="Адрес ссылки"
                    value={link.url}
                    type="url"
                    onChange={(event) =>
                      patch(item.key, {
                        links: item.links.map((current, i) =>
                          i === linkIndex ? { ...current, url: event.target.value } : current,
                        ),
                      })
                    }
                    placeholder="https://…"
                    className={`${inputClass} min-h-9 text-meta`}
                  />
                  <IconButton
                    label="Убрать ссылку"
                    onClick={() => patch(item.key, { links: item.links.filter((_, i) => i !== linkIndex) })}
                  >
                    <Trash2 size={13} />
                  </IconButton>
                </li>
              ))}
            </ul>
            <div>
              <Button
                tone="quiet"
                size="sm"
                onClick={() => patch(item.key, { links: [...item.links, { label: "", url: "" }] })}
              >
                <Link2 size={13} />
                Добавить ссылку
              </Button>
            </div>
          </div>

          <div className="flex gap-1.5 md:flex-col">
            <IconButton label="Выше" onClick={() => update((list) => move(list, index, index - 1))} disabled={index === 0}>
              <ArrowUp size={13} />
            </IconButton>
            <IconButton
              label="Ниже"
              onClick={() => update((list) => move(list, index, index + 1))}
              disabled={index === items.length - 1}
            >
              <ArrowDown size={13} />
            </IconButton>
            <IconButton label="Удалить материал" onClick={() => update((list) => list.filter((current) => current.key !== item.key))}>
              <Trash2 size={13} />
            </IconButton>
          </div>
        </article>
      ))}

      <div className="sticky bottom-4 z-10 flex flex-wrap items-center gap-3 rounded-soft border border-[var(--line)] bg-white/95 p-3 shadow-[var(--shadow-brand)] backdrop-blur">
        <Button
          tone="quiet"
          onClick={() =>
            update((list) => [
              ...list,
              {
                key: key(),
                id: `m${Date.now().toString(36)}`,
                day: list.at(-1)?.day ?? 1,
                kind: "Лекция",
                title: "",
                speakers: [],
                links: [{ label: "Материал", url: "" }],
              },
            ])
          }
        >
          <Plus size={15} />
          Добавить материал
        </Button>
        <Button onClick={save} disabled={pending || !dirty}>
          {pending ? "Сохраняем…" : dirty ? "Сохранить материалы" : "Сохранено"}
        </Button>
        <Result state={state} />
      </div>
    </div>
  );
}
