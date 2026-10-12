"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { KeyRound, MailCheck, ShieldCheck } from "lucide-react";

/**
 * Вход по коду на почту или телефон.
 *
 * Пока почтовый и SMS-провайдеры не подключены, вне production код
 * возвращается прямо в ответе и показывается на экране — так вход можно
 * проверить, не настраивая рассылку.
 */
export function JoinForm({ authEnabled }: { authEnabled: boolean }) {
  const router = useRouter();
  const [contact, setContact] = useState("");
  const [code, setCode] = useState("");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (!authEnabled) {
    return (
      <div className="rounded-[26px] border border-[var(--line)] bg-white p-8">
        <p className="eyebrow mb-3">Этап разработки</p>
        <h3 className="m-0 mb-3 font-display text-2xl font-semibold tracking-[-0.03em] text-navy">
          Вход подключается вместе с базой данных
        </h3>
        <p className="m-0 max-w-[720px] text-sm leading-relaxed text-ink-soft">
          Сейчас платформа работает на демонстрационных данных. Персональные ссылки,
          коды входа и рабочее пространство программы включаются, когда подключена
          база — инструкция есть в файле <b className="text-ink">ЗАПУСК.md</b>.
        </p>
      </div>
    );
  }

  const requestCode = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/request-code", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contact }),
      });
      const data = (await response.json()) as { ok: boolean; devCode?: string; reason?: string };
      if (!data.ok) {
        setError(data.reason ?? "Не удалось отправить код");
        return;
      }
      setDevCode(data.devCode ?? null);
    } finally {
      setBusy(false);
    }
  };

  const verify = async () => {
    setBusy(true);
    setError(null);
    try {
      const response = await fetch("/api/auth/verify", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ contact, code }),
      });
      const data = (await response.json()) as { ok: boolean; reason?: string };
      if (!data.ok) {
        setError(data.reason ?? "Код не подошёл");
        return;
      }
      router.push("/");
      router.refresh();
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="grid gap-4 md:grid-cols-2">
      <section className="card p-7">
        <span
          className="mb-5 grid size-11 place-items-center rounded-full"
          style={{ background: "rgba(34,63,154,0.08)", color: "#223F9A" }}
        >
          <MailCheck size={18} />
        </span>
        <h3 className="m-0 mb-2 font-display text-xl font-semibold tracking-[-0.02em] text-navy">
          Код на почту или телефон
        </h3>
        <p className="m-0 mb-5 text-[13px] leading-relaxed text-ink-soft">
          Укажите адрес, на который пришло приглашение. Пароль не нужен — только код.
        </p>

        <label className="mb-3 flex flex-col gap-1.5">
          <span className="text-[12px] font-semibold tracking-[0.06em] text-ink-faint uppercase">
            Почта или телефон
          </span>
          <input
            value={contact}
            onChange={(event) => setContact(event.target.value)}
            placeholder="name@example.org"
            className="min-h-11 w-full rounded-[14px] border border-[var(--line)] px-4 text-[14px] outline-none focus:border-navy"
          />
        </label>

        <button
          type="button"
          onClick={requestCode}
          disabled={busy || contact.trim().length === 0}
          className="mb-4 inline-flex min-h-11 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-navy text-[14px] font-semibold text-white transition-colors duration-200 hover:bg-navy-deep disabled:cursor-not-allowed disabled:opacity-40"
        >
          Получить код
        </button>

        {devCode && (
          <p className="m-0 mb-4 rounded-[14px] border border-[var(--line)] bg-[var(--color-sky-tint)] px-4 py-3 text-[13px] text-sky-ink">
            Демонстрационный режим: код <b className="tracking-[0.18em]">{devCode}</b>. В рабочей
            версии он уходит на почту или в SMS.
          </p>
        )}

        <div className="flex gap-2">
          <input
            value={code}
            onChange={(event) => setCode(event.target.value)}
            placeholder="Код из письма"
            inputMode="numeric"
            className="min-h-11 w-full rounded-[14px] border border-[var(--line)] px-4 text-[14px] tracking-[0.18em] outline-none focus:border-navy"
          />
          <button
            type="button"
            onClick={verify}
            disabled={busy || code.trim().length === 0}
            className="inline-flex min-h-11 shrink-0 cursor-pointer items-center gap-2 rounded-full border border-[var(--line)] bg-white px-5 text-[14px] font-semibold text-navy transition-all duration-200 ease-brand hover:-translate-y-0.5 disabled:cursor-not-allowed disabled:opacity-40"
          >
            <KeyRound size={15} />
            Войти
          </button>
        </div>

        {error && <p className="m-0 mt-3 text-[13px] text-[#C1394A]">{error}</p>}
      </section>

      <section className="card p-7">
        <span
          className="mb-5 grid size-11 place-items-center rounded-full"
          style={{
            background: "color-mix(in oklab, var(--accent, #54a4db) 14%, white)",
            color: "var(--navy)",
          }}
        >
          <ShieldCheck size={18} />
        </span>
        <h3 className="m-0 mb-2 font-display text-xl font-semibold tracking-[-0.02em] text-navy">
          Персональная ссылка
        </h3>
        <p className="m-0 mb-5 text-[13px] leading-relaxed text-ink-soft">
          Самый простой путь для слушателя: команда Центра формирует список участников
          и рассылает каждому личную ссылку. Она одноразовая и сразу открывает
          программу — ни логина, ни кода вводить не нужно.
        </p>
        <p className="m-0 rounded-[14px] border border-[var(--line)] px-4 py-3 text-[13px] leading-relaxed text-ink-soft">
          Получили ссылку? Просто откройте её. Если ссылка потерялась — запросите код
          на почту слева, он ведёт к тому же приглашению.
        </p>
      </section>
    </div>
  );
}
