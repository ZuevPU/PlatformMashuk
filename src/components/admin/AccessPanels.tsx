"use client";

import { useActionState, useMemo, useState, useTransition } from "react";
import { Download, KeyRound, Search, ShieldAlert, UserPlus, UserX } from "lucide-react";
import {
  addMemberAction,
  changeMemberRoleAction,
  issueMissingPasswordsAction,
  removeMemberAction,
  resetMemberPasswordAction,
  setProgramPasswordAction,
} from "@/lib/admin-actions";
import type { AdminState } from "@/lib/admin-actions";
import type { AdminMember } from "@/lib/admin";
import type { MemberRole } from "@/lib/types";
import { MEMBER_ROLE_LABELS } from "@/lib/types";
import { Button, Result, Select, TextField, inputClass } from "./ui";

/* --- Пароль программы ---------------------------------------------------- */

export function ProgramPasswordPanel({ slug, hasPassword }: { slug: string; hasPassword: boolean }) {
  const [state, action, pending] = useActionState(setProgramPasswordAction, {});
  const [custom, setCustom] = useState("");

  return (
    <div className="flex flex-col gap-5">
      <p className="m-0 flex items-center gap-2.5 text-ui text-ink">
        <span
          className={`size-2.5 rounded-full ${hasPassword ? "bg-spring" : "bg-ink-faint"}`}
          aria-hidden="true"
        />
        {hasPassword
          ? "Вход по паролю программы открыт"
          : "Вход по паролю программы закрыт — новые участники не смогут войти сами"}
      </p>

      <div className="grid gap-4 lg:grid-cols-[minmax(0,1fr)_auto] lg:items-end">
        <form action={action} className="flex flex-wrap items-end gap-3">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="mode" value="custom" />
          <div className="min-w-55 flex-1">
            <TextField
              label="Свой пароль"
              name="password"
              value={custom}
              onChange={(event) => setCustom(event.target.value)}
              minLength={8}
              placeholder="Не короче 8 символов"
              autoComplete="off"
            />
          </div>
          <Button type="submit" disabled={pending || custom.length < 8}>
            Задать
          </Button>
        </form>

        <div className="flex flex-wrap gap-3">
          <form action={action}>
            <input type="hidden" name="slug" value={slug} />
            <input type="hidden" name="mode" value="generate" />
            <Button type="submit" tone="quiet" disabled={pending}>
              <KeyRound size={15} />
              Сгенерировать
            </Button>
          </form>
          {hasPassword && (
            <form action={action}>
              <input type="hidden" name="slug" value={slug} />
              <input type="hidden" name="mode" value="disable" />
              <Button type="submit" tone="danger" disabled={pending}>
                Закрыть вход
              </Button>
            </form>
          )}
        </div>
      </div>

      <Result state={state} />
      <p className="m-0 text-caption leading-relaxed text-ink-faint">
        Пароль хранится в зашифрованном виде и показывается только один раз — сразу после
        смены. Смена пароля не выкидывает тех, кто уже вошёл.
      </p>
    </div>
  );
}

/* --- Участники ----------------------------------------------------------- */

export function MembersPanel({
  slug,
  members,
  isCenterAdmin,
  selfId,
}: {
  slug: string;
  members: AdminMember[];
  isCenterAdmin: boolean;
  selfId: string;
}) {
  const [state, action, pending] = useActionState(addMemberAction, {});
  const [rowState, setRowState] = useState<AdminState>({});
  const [busy, startTransition] = useTransition();
  const [query, setQuery] = useState("");

  const visible = useMemo(() => {
    const needle = query.trim().toLowerCase();
    if (!needle) return members;
    return members.filter((member) =>
      [member.name, member.contact, member.org, member.city]
        .filter(Boolean)
        .join(" ")
        .toLowerCase()
        .includes(needle),
    );
  }, [members, query]);

  const run = (task: () => Promise<AdminState>) =>
    startTransition(async () => {
      setRowState(await task());
    });

  const missing = members.filter((member) => !member.activated && canTouch(member)).length;

  function canTouch(member: AdminMember) {
    return (
      member.id !== selfId && (isCenterAdmin || (member.role === "participant" && !member.centerAdmin))
    );
  }

  return (
    <div className="flex flex-col gap-8">
      <form action={action} className="flex flex-col gap-4 rounded-soft bg-paper-warm p-5">
        <input type="hidden" name="slug" value={slug} />
        <p className="m-0 font-display text-body font-semibold text-navy">Добавить участника</p>
        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <TextField
            label="Имя и фамилия"
            name="name"
            defaultValue={state.values?.name}
            required
            minLength={2}
          />
          <TextField
            label="Почта или телефон"
            name="contact"
            defaultValue={state.values?.contact}
            required
            hint="Логин для входа"
          />
          <TextField label="Организация" name="org" defaultValue={state.values?.org} />
          <Select label="Роль" name="role" defaultValue={state.values?.role ?? "participant"}>
            <option value="participant">Участник</option>
            {isCenterAdmin && <option value="moderator">Модератор</option>}
            {isCenterAdmin && <option value="admin">Администратор программы</option>}
          </Select>
        </div>
        <div className="flex flex-wrap items-center gap-4">
          <Button type="submit" disabled={pending}>
            <UserPlus size={15} />
            {pending ? "Добавляем…" : "Добавить и выдать пароль"}
          </Button>
          <Result state={state} />
        </div>
      </form>

      <div className="flex flex-col gap-4">
        <div className="flex flex-wrap items-center gap-3">
          <p className="m-0 font-display text-body font-semibold text-navy">
            В программе: {members.length}
          </p>
          <label className="relative ml-auto w-full max-w-80">
            <span className="sr-only">Поиск по участникам</span>
            <Search size={15} className="pointer-events-none absolute top-1/2 left-3.5 -translate-y-1/2 text-ink-faint" />
            <input
              value={query}
              onChange={(event) => setQuery(event.target.value)}
              placeholder="Имя, логин, организация"
              className={`${inputClass} pl-10`}
            />
          </label>
        </div>

        {missing > 0 && (
          <div className="flex flex-wrap items-center gap-3 rounded-field border border-danger/30 bg-danger/5 px-4 py-3 text-meta text-ink">
            <ShieldAlert size={16} className="shrink-0 text-danger" />
            <span>
              Без пароля: <b>{missing}</b>. Такие участники не могут войти — пароль программы
              к уже заведённой записи доступа не даёт.
            </span>
            <Button
              size="sm"
              className="ml-auto"
              disabled={busy}
              onClick={() => {
                if (confirm(`Выдать пароли участникам без пароля (${missing})?`)) {
                  run(() => issueMissingPasswordsAction({ slug }));
                }
              }}
            >
              <KeyRound size={13} />
              Выдать пароли
            </Button>
          </div>
        )}

        <Result state={rowState} />
        {rowState.issued && rowState.issued.length > 0 && <IssuedList issued={rowState.issued} slug={slug} />}

        <div className="overflow-x-auto rounded-2xl border border-[var(--line)]">
          <table className="w-full min-w-180 border-collapse text-left text-meta">
            <thead className="bg-paper-warm text-ink-soft">
              <tr>
                <th className="px-4 py-3 font-semibold">Участник</th>
                <th className="px-4 py-3 font-semibold">Логин</th>
                <th className="px-4 py-3 font-semibold">Роль</th>
                <th className="px-4 py-3 font-semibold">Вход</th>
                <th className="px-4 py-3" aria-label="Действия" />
              </tr>
            </thead>
            <tbody>
              {visible.map((member) => (
                <tr key={member.id} className="border-t border-[var(--line)] align-middle">
                  <td className="px-4 py-3">
                    <span className="block font-semibold text-ink">{member.name}</span>
                    {(member.org || member.position) && (
                      <span className="block text-caption text-ink-faint">
                        {[member.position, member.org].filter(Boolean).join(", ")}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3 text-ink-soft">{member.contact ?? "—"}</td>
                  <td className="px-4 py-3">
                    {isCenterAdmin && member.id !== selfId ? (
                      <select
                        aria-label={`Роль: ${member.name}`}
                        value={member.role}
                        disabled={busy}
                        onChange={(event) =>
                          run(() =>
                            changeMemberRoleAction({
                              slug,
                              memberId: member.id,
                              role: event.target.value as MemberRole,
                            }),
                          )
                        }
                        className={`${inputClass} min-h-9 w-auto cursor-pointer py-0 text-meta`}
                      >
                        <option value="participant">Участник</option>
                        <option value="moderator">Модератор</option>
                        <option value="admin">Администратор</option>
                      </select>
                    ) : (
                      <span className="text-ink-soft">
                        {member.centerAdmin ? "Администратор Центра" : MEMBER_ROLE_LABELS[member.role]}
                      </span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {member.activated ? (
                      <span className="text-ink-soft">Есть пароль</span>
                    ) : (
                      <span className="font-semibold text-danger">Нет пароля</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    {canTouch(member) && (
                      <div className="flex justify-end gap-2">
                        <Button
                          tone="quiet"
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            if (confirm(`Выдать ${member.name} новый пароль? Старый перестанет работать.`)) {
                              run(() => resetMemberPasswordAction({ slug, memberId: member.id }));
                            }
                          }}
                        >
                          <KeyRound size={13} />
                          {member.activated ? "Новый пароль" : "Выдать пароль"}
                        </Button>
                        <Button
                          tone="danger"
                          size="sm"
                          disabled={busy}
                          onClick={() => {
                            if (confirm(`Убрать ${member.name} из программы?`)) {
                              run(() => removeMemberAction({ slug, memberId: member.id }));
                            }
                          }}
                        >
                          <UserX size={13} />
                          Убрать
                        </Button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
              {visible.length === 0 && (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-ink-faint">
                    {members.length ? "Никого не нашли — проверьте написание" : "В программе пока никого нет"}
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/** Выданные пароли: показываются один раз, скачиваются таблицей для рассылки. */
function IssuedList({ issued, slug }: { issued: NonNullable<AdminState["issued"]>; slug: string }) {
  const download = () => {
    // Точка с запятой и BOM — чтобы Excel открыл файл с кириллицей без настройки
    const escape = (value: string) => `"${value.replace(/"/g, '""')}"`;
    const rows = [["Имя", "Логин", "Пароль"], ...issued.map((item) => [item.name, item.contact, item.password])];
    const BOM = String.fromCharCode(0xfeff);
    const csv = BOM + rows.map((row) => row.map(escape).join(";")).join(String.fromCharCode(13, 10));
    const link = document.createElement("a");
    link.href = URL.createObjectURL(new Blob([csv], { type: "text/csv;charset=utf-8" }));
    link.download = `${slug}-пароли.csv`;
    link.click();
    URL.revokeObjectURL(link.href);
  };

  return (
    <div className="flex flex-col gap-3 rounded-field border border-dashed border-navy/40 bg-sky-tint p-4">
      <div className="flex flex-wrap items-center gap-3">
        <p className="m-0 text-meta text-sky-ink">Пароли показываются один раз.</p>
        <Button tone="quiet" size="sm" className="ml-auto" onClick={download}>
          <Download size={13} />
          Скачать CSV
        </Button>
      </div>
      <ul className="m-0 grid list-none gap-1.5 p-0 text-meta">
        {issued.map((item) => (
          <li key={item.contact} className="grid grid-cols-[minmax(0,1fr)_minmax(0,1fr)_auto] gap-3">
            <span className="truncate text-ink">{item.name}</span>
            <span className="truncate text-ink-soft">{item.contact}</span>
            <code className="font-semibold tracking-[0.04em] text-navy select-all">{item.password}</code>
          </li>
        ))}
      </ul>
    </div>
  );
}
