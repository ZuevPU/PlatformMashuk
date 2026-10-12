import type { CSSProperties, ReactNode } from "react";
import Link from "next/link";
import { ButtonLink } from "@/components/ui/Button";
import { MountainLine } from "@/components/brand/MountainLine";
import { ProgramCard } from "@/components/programs/ProgramCard";
import { StatusChip } from "@/components/programs/StatusChip";
import { getShowcaseStats, getAllPrograms, filterPrograms } from "@/lib/data";
import { DIRECTIONS } from "@/lib/types";
import type { DirectionKey, ProgramStatus, SeasonKey } from "@/lib/types";
import { SEASONS, SEASON_ORDER, ICONS } from "@/lib/brand";
import { durationDays, formatDateRange, plural } from "@/lib/dates";

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
  { key: "all", label: "Все программы" },
  { key: "recruiting", label: "Идёт набор" },
  { key: "ongoing", label: "Идут сейчас" },
  { key: "finished", label: "Архив" },
];

const HOW_IT_WORKS = [
  {
    icon: ICONS.mountains,
    title: "Витрина программ",
    text: "Каталог всех программ Центра: набор, текущие и архив. Анонс, программа-расписание, состав экспертов, материалы.",
  },
  {
    icon: ICONS.cap,
    title: "Материалы программы",
    text: "Презентации, конспекты и рабочие листы по каждому блоку — с привязкой к дню и спикеру, а не ссылкой в общем чате.",
  },
  {
    icon: ICONS.bells,
    title: "Канал программы",
    text: "Посты команды Центра и обсуждение: комментарии, реакции, закреплённые сообщения, фотографии и упоминания.",
  },
  {
    icon: ICONS.fox,
    title: "Живые опросы",
    text: "Опросы и квизы в реальном времени прямо во время блока: облако слов, шкалы, рейтинги и лидерборд на экране.",
  },
];

export default async function HomePage({
  searchParams,
}: {
  searchParams: Promise<SearchParams>;
}) {
  const filters = readFilters(await searchParams);
  const all = await getAllPrograms();
  const stats = getShowcaseStats(all);
  const filtered = filterPrograms(all, filters);

  const live = all.filter((program) => program.status === "ongoing");
  const recruiting = all.filter((program) => program.status === "recruiting");
  const archive = all.filter((program) => program.status === "finished");

  return (
    <>
      {/* ---------------------------------------------------------------- HERO */}
      <section className="mesh relative min-h-[640px] pt-[104px] pb-[92px]">
        <div className="wrap relative">
          <p className="eyebrow eyebrow--light">Экосистема сопровождения слушателей</p>
          <h1 className="m-0 mb-7 max-w-[860px] font-display text-[clamp(44px,7.5vw,104px)] leading-[0.92] font-semibold tracking-[-0.07em] text-white">
            Программы
            <span className="block text-sky-light">Центра знаний «Машук»</span>
          </h1>
          <p className="lead lead--light mb-10 max-w-[720px]">
            Программы, материалы, общение участников и живая обратная связь — в одной среде.
            Витрина открыта всем, рабочее пространство программы — для её участников.
          </p>

          <div className="flex flex-wrap gap-3">
            <ButtonLink href="#programs" variant="light">
              Смотреть программы
            </ButtonLink>
            <ButtonLink href="#how" variant="ghost">
              Как это работает
            </ButtonLink>
          </div>

          <div className="mt-14 grid gap-2.5 sm:grid-cols-3">
            <Fact value={`${stats.programs}`} label="программ в каталоге платформы" />
            <Fact value={`${stats.participants}`} label="слушателей в этих программах" />
            <Fact value={`${stats.days}`} label={`${plural(stats.days, "день", "дня", "дней")} расписания с блоками и экспертами`} />
          </div>
        </div>
        <MountainLine className="text-white" />
      </section>

      {/* -------------------------------------------------------- ИДУТ СЕЙЧАС */}
      {(live.length > 0 || recruiting.length > 0) && (
        <section className="section" id="now">
          <div className="wrap">
            <div className="mb-11 flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="eyebrow">Прямо сейчас</p>
                <h2 className="section-title section-title--tight">Идут и готовятся к старту</h2>
              </div>
              <p className="m-0 max-w-[380px] text-sm leading-relaxed text-ink-soft">
                Каждые несколько дней в Центре стартует новая программа. Здесь — те, что идут
                сейчас или открыты для участников.
              </p>
            </div>

            <div className="grid gap-[18px] md:grid-cols-2 xl:grid-cols-3">
              {[...live, ...recruiting].slice(0, 3).map((program) => (
                <ProgramCard key={program.slug} program={program} />
              ))}
            </div>
          </div>
        </section>
      )}

      {/* ------------------------------------------------------------- КАТАЛОГ */}
      <section className="section pt-0" id="programs">
        <div className="wrap">
          <div className="mb-9 flex flex-wrap items-end justify-between gap-6">
            <div>
              <p className="eyebrow">Каталог</p>
              <h2 className="section-title section-title--tight">Все программы</h2>
            </div>

            <form action="/" method="get" className="flex w-full max-w-[380px] gap-2">
              {filters.status !== "all" && (
                <input type="hidden" name="status" value={filters.status} />
              )}
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
                className="min-h-12 w-full rounded-full border border-[var(--line)] bg-white px-5 text-sm text-ink outline-none transition-colors duration-200 focus:border-navy"
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
            <div className="grid gap-[18px] md:grid-cols-2 xl:grid-cols-3">
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
              <p className="m-0 max-w-[560px] text-sm leading-relaxed text-ink-soft">
                Попробуйте изменить фильтры или сбросить поиск — в каталоге{" "}
                {stats.programs} программ, включая архив с итогами.
              </p>
              <ButtonLink href="/#programs" variant="outline" size="sm">
                Сбросить фильтры
              </ButtonLink>
            </div>
          )}
        </div>
      </section>

      {/* ---------------------------------------------------------- КАК РАБОТАЕТ */}
      <section className="section bg-sky-pale" id="how">
        <div className="wrap">
          <div className="mb-12 max-w-[780px]">
            <p className="eyebrow">Как это работает</p>
            <h2 className="section-title">Экосистема вокруг программы</h2>
            <p className="lead">
              Платформа не заменяет живое обучение и не подменяет методику. Она удерживает
              программу в одном месте: от анонса и расписания до материалов, обсуждения
              и обратной связи.
            </p>
          </div>

          <div className="grid gap-[18px] md:grid-cols-2 xl:grid-cols-4">
            {HOW_IT_WORKS.map((item) => (
              <article key={item.title} className="card card--hover p-7">
                {/* eslint-disable-next-line @next/next/no-img-element -- фирменный SVG-набор */}
                <img src={item.icon} alt="" aria-hidden="true" className="mb-7 h-12 w-12" />
                <h3 className="m-0 mb-2.5 font-display text-xl font-semibold tracking-[-0.02em] text-navy">
                  {item.title}
                </h3>
                <p className="m-0 text-sm leading-relaxed text-ink-soft">{item.text}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* -------------------------------------------------------------- АРХИВ */}
      {archive.length > 0 && (
        <section className="section" id="archive">
          <div className="wrap">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="eyebrow">Архив</p>
                <h2 className="section-title section-title--tight">Итоги прошедших программ</h2>
              </div>
              <p className="m-0 max-w-[400px] text-sm leading-relaxed text-ink-soft">
                После каждой программы команда Центра собирает авторский одностраничник с
                итогами, ходом программы и материалами по дням.
              </p>
            </div>

            <div className="flex flex-col gap-3">
              {archive.map((program) => (
                <article
                  key={program.slug}
                  data-season={program.season}
                  className="card flex-col items-start gap-5 p-6 md:flex-row md:items-center md:gap-7"
                  style={
                    {
                      "--accent": SEASONS[program.season].accent,
                      "--accent-strong": SEASONS[program.season].strong,
                    } as CSSProperties
                  }
                >
                  <div className="min-w-0 flex-1">
                    <div className="mb-2 flex flex-wrap items-center gap-3">
                      <StatusChip status={program.status} />
                      <span className="text-[12px] text-ink-faint">
                        {formatDateRange(program.startDate, program.endDate)}
                      </span>
                      <span className="text-[12px] text-ink-faint">
                        {durationDays(program.startDate, program.endDate)} дн.
                      </span>
                      {program.participants && (
                        <span className="text-[12px] text-ink-faint">
                          {program.participants} участников
                        </span>
                      )}
                    </div>
                    <h3 className="m-0 mb-1 font-display text-[22px] leading-tight font-semibold tracking-[-0.03em] text-navy">
                      <Link href={`/programs/${program.slug}`} className="no-underline hover:underline">
                        {program.title}
                      </Link>
                    </h3>
                    <p className="m-0 text-[13px] text-ink-soft">
                      {program.subtitle}
                      {program.stream ? ` · ${program.stream}` : ""}
                    </p>
                  </div>

                  <div className="flex flex-wrap gap-2.5">
                    <ButtonLink href={`/programs/${program.slug}`} variant="outline" size="sm">
                      Материалы программы
                    </ButtonLink>
                    {program.landing && (
                      <ButtonLink href={program.landing.url} size="sm" external>
                        Итоги программы
                      </ButtonLink>
                    )}
                  </div>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}
    </>
  );
}

function Fact({ value, label }: { value: string; label: string }) {
  return (
    <div className="glass px-5 py-[18px]">
      <b className="mb-1.5 block font-display text-[23px] font-semibold tracking-[-0.02em] text-white">
        {value}
      </b>
      <span className="text-[13px] leading-snug text-white/72">{label}</span>
    </div>
  );
}

function FilterRow({ label, children }: { label: string; children: ReactNode }) {
  return (
    <div className="flex flex-wrap items-center gap-2">
      <span className="mr-1 w-[104px] shrink-0 text-[11px] font-semibold uppercase tracking-[0.14em] text-gold">
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
        "inline-flex min-h-9 items-center gap-2 rounded-full border px-3.5 text-[13px] font-medium no-underline transition-all duration-200 ease-brand",
        active
          ? "border-navy bg-navy text-white"
          : "border-[var(--line)] bg-white text-navy hover:-translate-y-0.5",
      ].join(" ")}
    >
      {children}
    </Link>
  );
}
