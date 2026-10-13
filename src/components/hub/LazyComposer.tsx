"use client";

import dynamic from "next/dynamic";

/**
 * Редактор TipTap — самый тяжёлый модуль хаба. Он грузится отдельным
 * файлом после отрисовки страницы: лента, чаты и опросы появляются сразу.
 */
export const Composer = dynamic(() => import("./Composer").then((module) => module.Composer), {
  ssr: false,
  loading: () => (
    <div
      aria-hidden="true"
      className="min-h-23 animate-pulse rounded-soft border border-[var(--line)] bg-white"
    />
  ),
});
