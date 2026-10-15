"use client";

import { useState } from "react";
import type {
  InputHTMLAttributes,
  ReactNode,
  SelectHTMLAttributes,
  TextareaHTMLAttributes,
} from "react";
import { Check, Copy } from "lucide-react";
import type { AdminState } from "@/lib/admin-actions";

/**
 * Общие элементы админки. Спокойная рабочая поверхность в фирменных токенах:
 * одна белая панель на раздел, подписи полей обычным регистром, фокус всегда виден.
 */

export const inputClass =
  "min-h-11 w-full rounded-xl border border-[var(--line)] bg-white px-3.5 text-ui text-ink transition-colors duration-150 placeholder:text-ink-faint hover:border-navy/30 focus:border-navy focus-visible:outline-2 focus-visible:outline-offset-1 focus-visible:outline-navy";

export function Panel({
  title,
  description,
  aside,
  children,
}: {
  title: string;
  description?: ReactNode;
  aside?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-panel border border-[var(--line)] bg-white p-6 md:p-8">
      <header className="mb-6 flex flex-wrap items-start justify-between gap-4">
        <div className="max-w-160">
          <h2 className="m-0 font-display text-title font-semibold tracking-[-0.03em] text-navy">
            {title}
          </h2>
          {description && (
            <p className="m-0 mt-1.5 text-ui leading-relaxed text-ink-soft">{description}</p>
          )}
        </div>
        {aside}
      </header>
      {children}
    </section>
  );
}

export function Label({ children, hint }: { children: ReactNode; hint?: ReactNode }) {
  return (
    <span className="flex flex-col gap-0.5">
      <span className="text-meta font-semibold text-ink">{children}</span>
      {hint && <span className="text-caption leading-snug text-ink-faint">{hint}</span>}
    </span>
  );
}

export function TextField({
  label,
  hint,
  ...input
}: { label: string; hint?: ReactNode } & InputHTMLAttributes<HTMLInputElement>) {
  return (
    <label className="flex flex-col gap-2">
      <Label hint={hint}>{label}</Label>
      <input className={inputClass} {...input} />
    </label>
  );
}

export function TextArea({
  label,
  hint,
  ...input
}: { label: string; hint?: ReactNode } & TextareaHTMLAttributes<HTMLTextAreaElement>) {
  return (
    <label className="flex flex-col gap-2">
      <Label hint={hint}>{label}</Label>
      <textarea className={`${inputClass} min-h-24 py-2.5 leading-relaxed`} {...input} />
    </label>
  );
}

export function Select({
  label,
  hint,
  children,
  ...input
}: { label: string; hint?: ReactNode; children: ReactNode } & SelectHTMLAttributes<HTMLSelectElement>) {
  return (
    <label className="flex flex-col gap-2">
      <Label hint={hint}>{label}</Label>
      <select className={`${inputClass} cursor-pointer`} {...input}>
        {children}
      </select>
    </label>
  );
}

type ButtonTone = "primary" | "quiet" | "danger";

const TONES: Record<ButtonTone, string> = {
  primary: "bg-navy text-white hover:bg-navy-deep",
  quiet: "bg-white text-navy shadow-[inset_0_0_0_1px_var(--line)] hover:shadow-[inset_0_0_0_1px_rgba(34,63,154,0.4)]",
  danger: "bg-white text-ink shadow-[inset_0_0_0_1px_var(--line)] hover:bg-autumn/10 hover:shadow-[inset_0_0_0_1px_var(--color-autumn)]",
};

export function Button({
  tone = "primary",
  size = "md",
  className,
  children,
  ...button
}: {
  tone?: ButtonTone;
  size?: "md" | "sm";
} & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      type="button"
      className={[
        "inline-flex cursor-pointer items-center justify-center gap-2 rounded-full font-semibold whitespace-nowrap transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy disabled:cursor-wait disabled:opacity-50",
        size === "md" ? "min-h-11 px-5 text-ui" : "min-h-9 px-3.5 text-caption",
        TONES[tone],
        className,
      ]
        .filter(Boolean)
        .join(" ")}
      {...button}
    >
      {children}
    </button>
  );
}

/** Итог действия: ошибка, подтверждение и одноразовый пароль с кнопкой «Скопировать». */
export function Result({ state }: { state: AdminState }) {
  if (!state.error && !state.ok) return null;
  return (
    <div className="flex flex-col gap-3" role={state.error ? "alert" : "status"}>
      {state.error && (
        <p className="m-0 rounded-xl bg-autumn/10 px-4 py-3 text-meta leading-snug text-ink">
          {state.error}
        </p>
      )}
      {state.ok && (
        <p className="m-0 flex items-center gap-2 text-meta text-ink-soft">
          <Check size={15} className="shrink-0 text-teal" />
          {state.ok}
        </p>
      )}
      {state.secret && <Secret label={state.secret.label} value={state.secret.value} />}
    </div>
  );
}

export function Secret({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-field border border-dashed border-navy/40 bg-sky-tint px-4 py-3">
      <span className="text-meta text-sky-ink">{label}</span>
      <code className="font-display text-subtitle font-semibold tracking-[0.06em] text-navy select-all">
        {value}
      </code>
      <Button
        tone="quiet"
        size="sm"
        className="ml-auto"
        onClick={() => {
          void navigator.clipboard?.writeText(value).then(() => setCopied(true));
        }}
      >
        {copied ? <Check size={13} /> : <Copy size={13} />}
        {copied ? "Скопировано" : "Скопировать"}
      </Button>
    </div>
  );
}
