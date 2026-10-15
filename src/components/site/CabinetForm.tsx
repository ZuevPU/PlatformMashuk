"use client";

import { useActionState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import type { InputHTMLAttributes } from "react";
import { ArrowLeft, ArrowRight, KeyRound, LogOut, Save, ShieldAlert, Trash2, UserRound } from "lucide-react";
import {
  changePasswordAction,
  deleteAccountAction,
  logoutAction,
  updateProfileAction,
} from "@/lib/auth-actions";
import type { FormState } from "@/lib/auth-actions";
import { MEMBER_ROLE_LABELS } from "@/lib/types";
import type { MemberRole } from "@/lib/types";

const INPUT =
  "min-h-11 w-full rounded-field border border-[var(--line)] bg-white px-4 text-ui text-ink transition-colors duration-200 placeholder:text-ink-faint focus:border-navy focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-navy";

function Field({
  label,
  hint,
  ...input
}: { label: string; hint?: string } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-1.5">
      <span className="text-caption font-semibold tracking-[0.06em] text-ink-soft uppercase">
        {label}
      </span>
      <input className={INPUT} {...input} />
      {hint && <span className="text-caption leading-snug text-ink-faint">{hint}</span>}
    </label>
  );
}

function Message({ state }: { state: FormState }) {
  if (state.error) {
    return (
      <p role="alert" className="m-0 rounded-field bg-autumn/10 px-4 py-3 text-meta text-ink">
        {state.error}
      </p>
    );
  }
  if (state.ok) {
    return (
      <p className="m-0 rounded-field bg-sky-tint px-4 py-3 text-meta text-sky-ink">{state.ok}</p>
    );
  }
  return null;
}

export function CabinetForm({
  profile,
  programs,
  isCenterAdmin,
  adminError,
}: {
  profile: { name: string; contact: string; position: string; org: string; city: string };
  programs: { slug: string; title: string; role: MemberRole }[];
  isCenterAdmin: boolean;
  adminError: boolean;
}) {
  const [profileState, profileAction, profilePending] = useActionState(updateProfileAction, {});
  const [passwordState, passwordAction, passwordPending] = useActionState(changePasswordAction, {});
  const router = useRouter();

  const goBack = () => {
    if (typeof window !== "undefined" && window.history.length > 1) router.back();
    else router.push("/");
  };

  return (
    <div className="section">
      <div className="wrap max-w-180">
        <button
          type="button"
          onClick={goBack}
          className="mb-5 inline-flex cursor-pointer items-center gap-2 text-meta font-medium text-ink-soft transition-colors duration-200 hover:text-navy"
        >
          <ArrowLeft size={15} />
          Назад
        </button>
        <p className="eyebrow mb-2">Личный кабинет</p>
        <h1 className="section-title section-title--tight mb-8">{profile.name}</h1>

        {adminError && (
          <p className="mb-6 rounded-field bg-autumn/10 px-4 py-3 text-meta text-ink">
            Аккаунт администратора Центра удалить нельзя.
          </p>
        )}

        {programs.length > 0 && (
          <section className="card mb-6 p-7">
            <p className="eyebrow mb-4">Мои программы</p>
            <ul className="m-0 grid list-none gap-2.5 p-0">
              {programs.map((program) => (
                <li key={program.slug}>
                  <Link
                    href={`/programs/${program.slug}/hub`}
                    className="flex items-center gap-3 rounded-field border border-[var(--line)] bg-white px-4 py-3 no-underline transition-colors duration-150 hover:border-navy/30"
                  >
                    <span className="min-w-0 flex-1 truncate font-display text-body font-semibold text-navy">
                      {program.title}
                    </span>
                    <span className="rounded-full bg-sky-tint px-3 py-1 text-caption font-semibold text-sky-ink">
                      {MEMBER_ROLE_LABELS[program.role]}
                    </span>
                    <ArrowRight size={15} className="text-ink-faint" />
                  </Link>
                </li>
              ))}
            </ul>
          </section>
        )}

        <section className="card mb-6 p-7">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-sky-tint text-navy">
              <UserRound size={18} />
            </span>
            <h2 className="m-0 font-display text-title-lg font-semibold tracking-[-0.03em] text-navy">
              Профиль
            </h2>
          </div>

          <form action={profileAction} className="flex flex-col gap-4">
            <div className="grid gap-4 md:grid-cols-2">
              <Field label="Имя и фамилия" name="name" defaultValue={profile.name} required minLength={2} />
              <Field
                label="Почта или телефон"
                name="contact"
                defaultValue={profile.contact}
                hint="Это ваш логин для входа"
                required
              />
            </div>
            <div className="grid gap-4 md:grid-cols-3">
              <Field label="Должность" name="position" defaultValue={profile.position} />
              <Field label="Организация" name="org" defaultValue={profile.org} />
              <Field label="Город" name="city" defaultValue={profile.city} />
            </div>
            <Message state={profileState} />
            <div>
              <button
                type="submit"
                disabled={profilePending}
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-navy px-5 text-ui font-semibold text-white transition-colors duration-200 hover:bg-navy-deep disabled:cursor-wait disabled:opacity-60"
              >
                <Save size={15} />
                {profilePending ? "Сохраняем…" : "Сохранить профиль"}
              </button>
            </div>
          </form>
        </section>

        <section className="card mb-6 p-7">
          <div className="mb-5 flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-sky-tint text-navy">
              <KeyRound size={18} />
            </span>
            <h2 className="m-0 font-display text-title-lg font-semibold tracking-[-0.03em] text-navy">
              Пароль
            </h2>
          </div>

          <form action={passwordAction} className="flex flex-col gap-4">
            <Field label="Текущий пароль" name="current" type="password" autoComplete="current-password" required />
            <div className="grid gap-4 md:grid-cols-2">
              <Field
                label="Новый пароль"
                name="password"
                type="password"
                autoComplete="new-password"
                minLength={8}
                hint="Не короче 8 символов"
                required
              />
              <Field label="Повторите новый пароль" name="passwordRepeat" type="password" autoComplete="new-password" minLength={8} required />
            </div>
            <Message state={passwordState} />
            <div>
              <button
                type="submit"
                disabled={passwordPending}
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-[var(--line)] bg-white px-5 text-ui font-semibold text-navy transition-colors duration-200 hover:-translate-y-0.5 disabled:cursor-wait disabled:opacity-60"
              >
                <KeyRound size={15} />
                {passwordPending ? "Меняем…" : "Сменить пароль"}
              </button>
            </div>
          </form>
        </section>

        <section className="card mb-6 flex flex-wrap items-center gap-4 p-7">
          <div className="min-w-0 flex-1">
            <h2 className="m-0 font-display text-body font-semibold text-navy">Выйти из аккаунта</h2>
            <p className="m-0 text-meta text-ink-soft">Завершить сессию на этом устройстве.</p>
          </div>
          <form action={logoutAction}>
            <button
              type="submit"
              className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full border border-[var(--line)] bg-white px-5 text-ui font-semibold text-navy transition-colors duration-200 hover:-translate-y-0.5"
            >
              <LogOut size={15} />
              Выйти
            </button>
          </form>
        </section>

        <section className="rounded-panel border border-autumn/40 bg-autumn/5 p-7">
          <div className="mb-4 flex items-center gap-3">
            <span className="grid size-10 place-items-center rounded-full bg-autumn/15 text-autumn-ink">
              <ShieldAlert size={18} />
            </span>
            <h2 className="m-0 font-display text-body font-semibold text-ink">Удаление аккаунта</h2>
          </div>
          <p className="m-0 mb-5 max-w-140 text-meta leading-relaxed text-ink-soft">
            Аккаунт и личные данные будут удалены безвозвратно. Ваши сообщения в чатах и
            комментарии тоже удалятся. Это действие нельзя отменить.
          </p>
          {isCenterAdmin ? (
            <p className="m-0 text-meta text-ink-faint">Администратор Центра удаляется только вручную.</p>
          ) : (
            <form
              action={deleteAccountAction}
              onSubmit={(event) => {
                if (!window.confirm("Удалить аккаунт навсегда? Отменить будет нельзя.")) {
                  event.preventDefault();
                }
              }}
            >
              <button
                type="submit"
                className="inline-flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-autumn px-5 text-ui font-semibold text-white transition-colors duration-200 hover:opacity-90"
              >
                <Trash2 size={15} />
                Удалить аккаунт
              </button>
            </form>
          )}
        </section>
      </div>
    </div>
  );
}
