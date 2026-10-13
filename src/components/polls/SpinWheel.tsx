"use client";

import { useState } from "react";
import { RotateCw } from "lucide-react";
import type { QuestionOption } from "@/lib/types";

/**
 * Колесо-рулетка: ведущий крутит, выпадает случайный вариант.
 * Ответы участников не нужны — это инструмент для зала.
 */
export function SpinWheel({
  options,
  interactive = true,
}: {
  options: QuestionOption[];
  interactive?: boolean;
}) {
  const [current, setCurrent] = useState(0);
  const [spinning, setSpinning] = useState(false);
  const [winner, setWinner] = useState<string | null>(null);

  const spin = () => {
    if (spinning || options.length === 0) return;
    setSpinning(true);
    setWinner(null);
    const total = 16 + Math.floor(Math.random() * 10);
    let ticks = 0;
    const timer = setInterval(() => {
      setCurrent((value) => (value + 1) % options.length);
      ticks += 1;
      if (ticks >= total) {
        clearInterval(timer);
        const index = Math.floor(Math.random() * options.length);
        setCurrent(index);
        setWinner(options[index].text);
        setSpinning(false);
      }
    }, 90);
  };

  return (
    <div className="rounded-panel border border-[var(--line)] bg-white p-8 text-center">
      <div
        className="mx-auto mb-6 grid min-h-32 place-items-center rounded-2xl px-6"
        style={{ background: "color-mix(in oklab, var(--accent) 10%, white)" }}
      >
        <span
          className={[
            "font-display text-[clamp(28px,4vw,46px)] leading-tight font-semibold tracking-[-0.03em]",
            spinning ? "text-ink-soft" : "text-navy",
          ].join(" ")}
        >
          {options[current]?.text ?? "—"}
        </span>
      </div>

      {winner && !spinning && (
        <p className="m-0 mb-5 font-display text-lead font-semibold" style={{ color: "var(--accent-ink)" }}>
          Выпало: {winner}
        </p>
      )}

      {interactive && (
        <button
          type="button"
          onClick={spin}
          disabled={spinning || options.length === 0}
          className="inline-flex min-h-12 cursor-pointer items-center gap-2 rounded-full bg-navy px-6 text-ui font-semibold text-white transition-colors duration-200 hover:bg-navy-deep disabled:cursor-wait disabled:opacity-60"
        >
          <RotateCw size={16} className={spinning ? "motion-safe:animate-spin" : undefined} />
          {spinning ? "Крутится…" : "Крутить колесо"}
        </button>
      )}
    </div>
  );
}
