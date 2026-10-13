"use client";

import { useMemo, useState } from "react";
import { Search, SlidersHorizontal, X } from "lucide-react";
import { ProgramCard } from "@/components/programs/ProgramCard";
import { DIRECTIONS } from "@/lib/types";
import type { DirectionKey, ProgramStatus, ProgramView, SeasonKey } from "@/lib/types";
import { SEASONS, SEASON_ORDER } from "@/lib/brand";

const STATUS_FILTERS: { key: ProgramStatus | "all"; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "recruiting", label: "Идёт набор" },
  { key: "ongoing", label: "Идут сейчас" },
  { key: "finished", label: "Завершённые" },
];

/**
 * Каталог программ: живой поиск (без кнопки) и фильтры, скрытые под кнопкой
 * «Фильтр программ». Фильтрация мгновенная — программы уже загружены списком.
 */
export function ProgramCatalog({ programs }: { programs: ProgramView[] }) {
  const [query, setQuery] = useState("");
  const [status, setStatus] = useState<ProgramStatus | "all">("all");
  const [direction, setDirection] = useState<DirectionKey | "all">("all");
  const [season, setSeason] = useState<SeasonKey | "all">("all");
  const [filtersOpen, setFiltersOpen] = useState(false);

  const activeFilters =
    (status !== "all" ? 1 : 0) + (direction !== "all" ? 1 : 0) + (season !== "all" ? 1 : 0);

  const filtered = useMemo(() => {
    const needle = query.trim().toLowerCase();
    return programs.filter((program) => {
      if (status !== "all" && program.status !== status) return false;
      if (direction !== "all" && program.direction !== direction) return false;
      if (season !== "all" && program.season !== season) return false;
      if (needle) {
        const haystack = [program.title, program.subtitle, program.location, program.about.lead]
          .join(" ")
          .toLowerCase();
        if (!haystack.includes(needle)) return false;
      }
      return true;
    });
  }, [programs, status, direction, season, query]);

  const reset = () => {
    setStatus("all");
    setDirection("all");
    setSeason("all");
  };

  return (
    <div>
      {/* Поиск и кнопка фильтров */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search
            size={17}
            aria-hidden="true"
            className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-ink-faint"
          />
          <input
            type="search"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Поиск программ"
            aria-label="Поиск программ"
            className="min-h-12 w-full rounded-full border border-[var(--line)] bg-white pr-11 pl-11 text-ui text-ink outline-none transition-colors duration-200 placeholder:text-ink-faint focus:border-navy focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
          />
          {query && (
            <button
              type="button"
              onClick={() => setQuery("")}
              aria-label="Очистить поиск"
              className="absolute top-1/2 right-3 grid size-7 -translate-y-1/2 cursor-pointer place-items-center rounded-full text-ink-faint transition-colors hover:bg-sky-tint hover:text-navy"
            >
              <X size={15} />
            </button>
          )}
        </div>

        <button
          type="button"
          onClick={() => setFiltersOpen((value) => !value)}
          aria-expanded={filtersOpen}
          className={[
            "inline-flex min-h-12 shrink-0 cursor-pointer items-center justify-center gap-2 rounded-full border px-5 text-ui font-semibold transition-all duration-200 ease-brand",
            filtersOpen || activeFilters > 0
              ? "border-navy bg-navy text-white"
              : "border-[var(--line)] bg-white text-navy hover:-translate-y-0.5",
          ].join(" ")}
        >
          <SlidersHorizontal size={16} />
          Фильтр программ
          {activeFilters > 0 && (
            <span className="grid size-5 place-items-center rounded-full bg-white/25 text-micro">
              {activeFilters}
            </span>
          )}
        </button>
      </div>

      {/* Панель фильтров */}
      {filtersOpen && (
        <div className="mt-4 flex flex-col gap-4 rounded-2xl border border-[var(--line)] bg-white p-5">
          <FilterRow label="Статус">
            {STATUS_FILTERS.map((item) => (
              <Pill key={item.key} active={status === item.key} onClick={() => setStatus(item.key)}>
                {item.label}
              </Pill>
            ))}
          </FilterRow>

          <FilterRow label="Направление">
            <Pill active={direction === "all"} onClick={() => setDirection("all")}>
              Все
            </Pill>
            {DIRECTIONS.map((item) => (
              <Pill
                key={item.key}
                active={direction === item.key}
                onClick={() => setDirection(item.key)}
              >
                {item.label}
              </Pill>
            ))}
          </FilterRow>

          <FilterRow label="Сезон">
            <Pill active={season === "all"} onClick={() => setSeason("all")}>
              Все
            </Pill>
            {SEASON_ORDER.map((key) => (
              <Pill key={key} active={season === key} onClick={() => setSeason(key)}>
                <span
                  aria-hidden="true"
                  className="inline-block size-2.5 rounded-full"
                  style={{ background: SEASONS[key].accent }}
                />
                {SEASONS[key].label}
              </Pill>
            ))}
          </FilterRow>

          {activeFilters > 0 && (
            <button
              type="button"
              onClick={reset}
              className="w-fit cursor-pointer text-meta font-semibold text-navy underline"
            >
              Сбросить фильтры
            </button>
          )}
        </div>
      )}

      {/* Результат */}
      <p className="mt-6 mb-5 text-meta text-ink-faint">
        {filtered.length}{" "}
        {filtered.length === 1 ? "программа" : filtered.length < 5 ? "программы" : "программ"}
        {query ? ` по запросу «${query.trim()}»` : ""}
      </p>

      {filtered.length > 0 ? (
        <div className="grid gap-4.5 md:grid-cols-2 xl:grid-cols-3">
          {filtered.map((program) => (
            <ProgramCard key={program.slug} program={program} />
          ))}
        </div>
      ) : (
        <div className="card items-start gap-4 p-9">
          <p className="eyebrow mb-0">Ничего не найдено</p>
          <h3 className="m-0 font-display text-2xl font-semibold tracking-[-0.03em] text-navy">
            Под эти условия программ нет
          </h3>
          <p className="m-0 max-w-140 text-sm leading-relaxed text-ink-soft">
            Попробуйте изменить запрос или сбросить фильтры.
          </p>
          <button
            type="button"
            onClick={() => {
              setQuery("");
              reset();
            }}
            className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full bg-navy px-5 text-ui font-semibold text-white transition-colors duration-200 hover:bg-navy-deep"
          >
            Сбросить поиск
          </button>
        </div>
      )}
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 w-26 shrink-0 text-micro font-semibold tracking-[0.14em] text-gold-ink uppercase">
        {label}
      </span>
      {children}
    </div>
  );
}

function Pill({
  active,
  onClick,
  children,
}: {
  active: boolean;
  onClick: () => void;
  children: React.ReactNode;
}) {
  return (
    <button
      type="button"
      aria-pressed={active}
      onClick={onClick}
      className={[
        "inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full border px-3.5 text-meta font-medium transition-all duration-200 ease-brand",
        active
          ? "border-navy bg-navy text-white"
          : "border-[var(--line)] bg-white text-navy hover:-translate-y-0.5",
      ].join(" ")}
    >
      {children}
    </button>
  );
}
