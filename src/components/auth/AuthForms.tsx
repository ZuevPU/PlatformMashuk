"use client";

import { useActionState, useState } from "react";
import type { InputHTMLAttributes, ReactNode } from "react";
import { KeyRound, LogIn, UserPlus } from "lucide-react";
import { enterProgramAction, loginAction } from "@/lib/auth-actions";
import type { FormState } from "@/lib/auth-actions";

/**
 * Формы входа. Работают и без JavaScript: это обычные формы с серверным
 * действием, а useActionState добавляет ошибки и состояние отправки.
 */

const INPUT =
  "min-h-11 w-full rounded-field border border-[var(--line)] bg-white px-4 text-ui text-ink transition-colors duration-200 placeholder:text-ink-faint focus:border-navy focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-navy";

export function Field({
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

function SubmitButton({ pending, children }: { pending: boolean; children: ReactNode }) {
  return (
    <button
      type="submit"
      disabled={pending}
      className="inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-navy text-ui font-semibold text-white transition-colors duration-200 hover:bg-navy-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:cursor-wait disabled:opacity-60"
    >
      {pending ? "Проверяем…" : children}
    </button>
  );
}

function FormError({ state }: { state: FormState }) {
  if (!state.error) return null;
  return (
    <p role="alert" className="m-0 rounded-field bg-autumn/10 px-4 py-3 text-meta leading-snug text-ink">
      {state.error}
    </p>
  );
}

/* --- Вход по личному паролю ---------------------------------------------- */

export function LoginForm({ next }: { next?: string }) {
  const [state, action, pending] = useActionState(loginAction, {});

  return (
    <form action={action} className="flex flex-col gap-4">
      {next && <input type="hidden" name="next" value={next} />}
      <Field
        label="Почта или телефон"
        name="contact"
        autoComplete="username"
        placeholder="name@example.org"
        defaultValue={state.values?.contact}
        required
      />
      <Field
        label="Пароль"
        name="password"
        type="password"
        autoComplete="current-password"
        required
      />
      <FormError state={state} />
      <SubmitButton pending={pending}>
        <LogIn size={16} />
        Войти
      </SubmitButton>
    </form>
  );
}

/* --- Вход в программу ---------------------------------------------------- */

export function EnterProgramForm({
  slug,
  signedInAs,
  next,
}: {
  slug: string;
  /** Человек уже вошёл на платформу — нужен только пароль программы */
  signedInAs?: string;
  /** Куда вернуться после входа (например, ссылка на живой опрос) */
  next?: string;
}) {
  const [mode, setMode] = useState<"new" | "member">("new");
  const [state, action, pending] = useActionState(enterProgramAction, {});
  const backTo = next && next.startsWith("/") && !next.startsWith("//") ? next : `/programs/${slug}/hub`;

  if (signedInAs) {
    return (
      <form action={action} className="flex flex-col gap-4">
        <input type="hidden" name="slug" value={slug} />
        <input type="hidden" name="next" value={backTo} />
        <p className="m-0 text-ui leading-relaxed text-ink-soft">
          Вы вошли как <b className="text-ink">{signedInAs}</b>. Введите пароль программы,
          чтобы присоединиться к её рабочему пространству.
        </p>
        <Field label="Пароль программы" name="programPassword" type="password" required />
        <FormError state={state} />
        <SubmitButton pending={pending}>
          <KeyRound size={16} />
          Присоединиться
        </SubmitButton>
      </form>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <div className="grid grid-cols-2 gap-1.5 rounded-full bg-sky-tint p-1.5" role="tablist">
        <TabButton active={mode === "new"} onClick={() => setMode("new")}>
          <UserPlus size={15} />
          Я впервые
        </TabButton>
        <TabButton active={mode === "member"} onClick={() => setMode("member")}>
          <LogIn size={15} />
          Я уже участник
        </TabButton>
      </div>

      {mode === "member" ? (
        <LoginForm next={backTo} />
      ) : (
        <form action={action} className="flex flex-col gap-4">
          <input type="hidden" name="slug" value={slug} />
          <input type="hidden" name="next" value={next && next.startsWith("/") && !next.startsWith("//") ? next : ""} />
          <Field
            label="Пароль программы"
            name="programPassword"
            type="password"
            hint="Его сообщают организаторы программы"
            required
          />
          <div className="my-1 h-px bg-[var(--line)]" />
          <Field
            label="Имя и фамилия"
            name="name"
            autoComplete="name"
            defaultValue={state.values?.name}
            required
            minLength={2}
          />
          <Field
            label="Почта или телефон"
            name="contact"
            autoComplete="username"
            placeholder="name@example.org"
            defaultValue={state.values?.contact}
            hint="Это ваш логин для следующих входов"
            required
          />
          <div className="grid gap-4 sm:grid-cols-2">
            <Field
              label="Придумайте пароль"
              name="password"
              type="password"
              autoComplete="new-password"
              minLength={8}
              hint="Не короче 8 символов"
              required
            />
            <Field
              label="Повторите пароль"
              name="passwordRepeat"
              type="password"
              autoComplete="new-password"
              minLength={8}
              required
            />
          </div>
          <details className="rounded-field border border-[var(--line)] px-4 py-3 text-meta text-ink-soft">
            <summary className="cursor-pointer font-semibold text-navy">
              Должность и организация — по желанию
            </summary>
            <div className="mt-4 flex flex-col gap-4">
              <Field
                label="Должность"
                name="position"
                autoComplete="organization-title"
                defaultValue={state.values?.position}
              />
              <Field label="Организация" name="org" autoComplete="organization" defaultValue={state.values?.org} />
              <Field label="Город" name="city" autoComplete="address-level2" defaultValue={state.values?.city} />
            </div>
          </details>
          <FormError state={state} />
          <SubmitButton pending={pending}>
            <KeyRound size={16} />
            Войти в программу
          </SubmitButton>
        </form>
      )}
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
        "inline-flex min-h-10 cursor-pointer items-center justify-center gap-2 rounded-full text-meta font-semibold transition-all duration-200 ease-brand focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy",
        active ? "bg-white text-navy shadow-[var(--shadow-soft)]" : "text-sky-ink hover:text-navy",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
