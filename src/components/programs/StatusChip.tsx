import type { CSSProperties } from "react";
import type { ProgramStatus } from "@/lib/types";

const LABELS: Record<ProgramStatus, string> = {
  recruiting: "Идёт набор",
  ongoing: "Идёт сейчас",
  finished: "Завершена",
};

/** Цвета чипа берутся из сезонной схемы через CSS-переменные.
 *  Текст — затемнённый акцент (color-mix с фирменным чёрным), чтобы
 *  светлые сезонные тона оставались читаемыми: контраст ≥ 4.5:1. */
const STYLES: Record<ProgramStatus, CSSProperties> = {
  recruiting: {
    background: "color-mix(in oklab, var(--accent) 15%, white)",
    color: "color-mix(in oklab, var(--accent) 62%, #0a1014)",
  },
  ongoing: {
    background: "#223f9a",
    color: "#ffffff",
  },
  finished: {
    background: "rgba(220, 222, 221, 0.6)",
    color: "#655d53",
  },
};

interface StatusChipProps {
  status: ProgramStatus;
  size?: "md" | "sm";
}

export function StatusChip({ status, size = "sm" }: StatusChipProps) {
  return (
    <span
      className="inline-flex items-center gap-2 rounded-full font-semibold whitespace-nowrap"
      style={{
        ...STYLES[status],
        fontSize: size === "md" ? 12 : 11,
        padding: size === "md" ? "7px 14px" : "6px 11px",
        lineHeight: 1.2,
      }}
    >
      {status === "ongoing" && (
        <span
          aria-hidden="true"
          className="inline-block size-1.5 rounded-full bg-white motion-safe:animate-pulse"
        />
      )}
      {LABELS[status]}
    </span>
  );
}
