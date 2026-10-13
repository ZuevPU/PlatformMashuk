"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { Hash, Smartphone } from "lucide-react";
import { MountainLine } from "@/components/brand/MountainLine";

/**
 * Вход в опрос по коду с телефона. Ведущий показывает четырёхзначный код
 * (и QR) на экране в зале — участник вводит его здесь и попадает к вопросам.
 */
export default function PollCodePage() {
  const router = useRouter();
  const [code, setCode] = useState("");

  const digits = code.replace(/\D/g, "").slice(0, 6);

  return (
    <section className="mesh relative min-h-dvh pt-24 pb-20">
      <div className="wrap relative max-w-130">
        <p className="eyebrow eyebrow--light">Живой опрос</p>
        <h1 className="m-0 mb-7 max-w-160 font-display text-[clamp(34px,5vw,60px)] leading-[0.98] font-semibold tracking-[-0.05em] text-white">
          Введите код с экрана
        </h1>

        <div className="card max-w-140 p-7">
          <label className="flex flex-col gap-2">
            <span className="text-caption font-semibold tracking-[0.06em] text-ink-soft uppercase">
              Код опроса
            </span>
            <input
              inputMode="numeric"
              autoComplete="one-time-code"
              placeholder="0000"
              value={digits}
              onChange={(event) => setCode(event.target.value)}
              onKeyDown={(event) => {
                if (event.key === "Enter" && digits) router.push(`/poll/${digits}`);
              }}
              className="min-h-16 w-full rounded-field border border-[var(--line)] bg-white px-5 text-center font-display text-display-sm font-semibold tracking-[0.18em] text-navy outline-none transition-colors duration-200 focus:border-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
            />
          </label>

          <button
            type="button"
            disabled={!digits}
            onClick={() => router.push(`/poll/${digits}`)}
            className="mt-5 inline-flex min-h-12 w-full cursor-pointer items-center justify-center gap-2 rounded-full bg-navy text-ui font-semibold text-white transition-colors duration-200 hover:bg-navy-deep disabled:cursor-not-allowed disabled:opacity-40"
          >
            <Hash size={16} />
            Открыть опрос
          </button>

          <p className="m-0 mt-5 flex items-center justify-center gap-2 text-caption text-ink-faint">
            <Smartphone size={14} />
            Код показывается на экране ведущего вместе с QR-кодом.
          </p>
        </div>
      </div>
      <MountainLine className="text-white" />
    </section>
  );
}
