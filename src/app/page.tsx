import type { ReactNode } from "react";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { MountainLine } from "@/components/brand/MountainLine";
import { ProgramCard } from "@/components/programs/ProgramCard";
import { getAllPrograms, filterPrograms } from "@/lib/data";
import { DIRECTIONS } from "@/lib/types";
import type { DirectionKey, ProgramStatus, SeasonKey } from "@/lib/types";
import { SEASONS, SEASON_ORDER } from "@/lib/brand";

type SearchParams = Record<string, string | string[] | undefined>;

interface FilterState {
  status: ProgramStatus | "all";
  direction: DirectionKey | "all";
  season: SeasonKey | "all";
  query: string;
}

function readFilters(searchParams: SearchParams): FilterState {
  const pick = (value: string | string[] | undefined) =>
    (Array.isArray(value) ? value[0] : value) ?? "";

  const status = pick(searchParams.status);
  const direction = pick(searchParams.direction);
  const season = pick(searchParams.season);

  return {
    status: (["recruiting", "ongoing", "finished"] as const).includes(status as ProgramStatus)
      ? (status as ProgramStatus)
      : "all",
    direction: DIRECTIONS.some((item) => item.key === direction)
      ? (direction as DirectionKey)
      : "all",
    season: SEASON_ORDER.includes(season as SeasonKey) ? (season as SeasonKey) : "all",
    query: pick(searchParams.q),
  };
}

function buildHref(filters: FilterState, patch: Partial<FilterState>): string {
  const merged = { ...filters, ...patch };
  const params = new URLSearchParams();
  if (merged.status !== "all") params.set("status", merged.status);
  if (merged.direction !== "all") params.set("direction", merged.direction);
  if (merged.season !== "all") params.set("season", merged.season);
  if (merged.query) params.set("q", merged.query);
  const qs = params.toString();
  return `${qs ? `/?${qs}` : "/"}#programs`;
}

const STATUS_FILTERS: { key: ProgramStatus | "all"; label: string }[] = [
  { key: "all", label: "Все" },
  { key: "recruiting", label: "Идёт набор" },
  { key: "ongoing", label: "Идут сейчас" },
  { key: "finished", label: "Завершённые" },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = readFilters(await searchParams);
  const all = await getAllPrograms();
  const filtered = filterPrograms(all, filters);

  return (
    <>
      {/* ---------------------------------------------------------------- HERO */}
      <section className="mesh relative pt-26 pb-20">
        <div className="wrap relative">
          <p className="eyebrow eyebrow--light">Экосистема сопровождения слушателей</p>
          <h1 className="m-0 mb-7 max-w-215 font-display text-[clamp(44px,7.5vw,104px)] leading-[0.92] font-semibold tracking-[-0.07em] text-white">
            Программы
            <span className="block text-sky-light">Центра знаний «Машук»</span>
          </h1>
          <p className="lead lead--light mb-9 max-w-180">
            Программы, материалы, общение участников и живая обратная связь — в одной среде.
            Рабочее пространство программы — для её участников.
          </p>

          <ButtonLink href="#programs" variant="light">
            Смотреть программы
          </ButtonLink>
        </div>
        <MountainLine className="text-white" />
      </section>

      {/* ------------------------------------------------------------- КАТАЛОГ */}
      <section className="section" id="programs">
        <div className="wrap">
          <div className="mb-9 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow">Каталог</p>
              <h2 className="section-title section-title--tight">Наши программы</h2>
            </div>

            <form action="/" method="get" className="flex w-full max-w-95 gap-2">
              {filters.status !== "all" && <input type="hidden" name="status" value={filters.status} />}
              {filters.direction !== "all" && (
                <input type="hidden" name="direction" value={filters.direction} />
              )}
              {filters.season !== "all" && (
                <input type="hidden" name="season" value={filters.season} />
              )}
              <input
                type="search"
                name="q"
                defaultValue={filters.query}
                placeholder="Поиск по названию или описанию"
                aria-label="Поиск программ"
                className="min-h-12 w-full rounded-full border border-[var(--line)] bg-white px-5 text-sm text-ink outline-none focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy transition-colors duration-200 focus:border-navy"
              />
              <button
                type="submit"
                className="min-h-12 cursor-pointer rounded-full bg-navy px-5 text-sm font-semibold text-white transition-colors duration-200 hover:bg-navy-deep"
              >
                Найти
              </button>
            </form>
          </div>

          {/* Фильтры — обычные ссылки: работают без JavaScript и индексируются */}
          <div className="mb-8 flex flex-col gap-4 border-y border-[var(--line)] py-5">
            <FilterRow label="Статус">
              {STATUS_FILTERS.map((item) => (
                <FilterPill
                  key={item.key}
                  href={buildHref(filters, { status: item.key })}
                  active={filters.status === item.key}
                >
                  {item.label}
                </FilterPill>
              ))}
            </FilterRow>

            <FilterRow label="Направление">
              <FilterPill
                href={buildHref(filters, { direction: "all" })}
                active={filters.direction === "all"}
              >
                Все
              </FilterPill>
              {DIRECTIONS.map((item) => (
                <FilterPill
                  key={item.key}
                  href={buildHref(filters, { direction: item.key })}
                  active={filters.direction === item.key}
                >
                  {item.label}
                </FilterPill>
              ))}
            </FilterRow>

            <FilterRow label="Сезон">
              <FilterPill href={buildHref(filters, { season: "all" })} active={filters.season === "all"}>
                Все
              </FilterPill>
              {SEASON_ORDER.map((key) => (
                <FilterPill
                  key={key}
                  href={buildHref(filters, { season: key })}
                  active={filters.season === key}
                >
                  <span
                    aria-hidden="true"
                    className="inline-block size-2.5 rounded-full"
                    style={{ background: SEASONS[key].accent }}
                  />
                  {SEASONS[key].label}
                </FilterPill>
              ))}
            </FilterRow>
          </div>

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
                Попробуйте изменить фильтры или сбросить поиск — всего в каталоге {all.length}{" "}
                {all.length === 1 ? "программа" : all.length < 5 ? "программы" : "программ"}.
              </p>
              <ButtonLink href="/#programs" variant="outline" size="sm">
                Сбросить фильтры
              </ButtonLink>
            </div>
          )}
        </div>
      </section>
    </>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 w-26 shrink-0 text-micro font-semibold uppercase tracking-[0.14em] text-gold-ink">
        {label}
      </span>
      {children}
    </div>
  );
}

function FilterPill({
  href,
  active,
  children,
}: {
  href: string;
  active: boolean;
  children: ReactNode;
}) {
  return (
    <Link
      href={href}
      className={[
        "inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 text-meta font-medium no-underline transition-all duration-200 ease-brand",
        active
          ? "border-navy bg-navy text-white"
          : "border-[var(--line)] bg-white text-navy hover:-translate-y-0.5",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}
