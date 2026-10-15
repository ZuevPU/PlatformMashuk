import type { CSSProperties } from "react";
import Link from "next/link";
import { StatusChip } from "./StatusChip";
import { ButtonLink } from "@/components/ui/Button";
import { durationDays, formatDateRange, relativeToStart } from "@/lib/dates";
import { SEASONS, seasonStyle } from "@/lib/brand";
import { DIRECTIONS } from "@/lib/types";
import type { ProgramView } from "@/lib/data";

export function ProgramCard({ program }: { program: ProgramView }) {
  const season = SEASONS[program.season];
  const direction = DIRECTIONS.find((item) => item.key === program.direction);
  const days = durationDays(program.startDate, program.endDate);

  return (
    <article
      className="card card--hover overflow-hidden"
      data-season={program.season}
      style={seasonStyle(program.season) as CSSProperties}
    >
      {/* Сезонный акцент — полоса фирменного цвета программы */}
      <div aria-hidden="true" className="h-1.5 w-full" style={{ background: season.accent }} />

      <div className="flex flex-1 flex-col p-7">
        <div className="mb-6 flex items-start justify-between gap-4">
          <div>
            <p className="mb-1.5 text-micro font-semibold uppercase tracking-[0.14em] text-gold-ink">
              {direction?.label}
            </p>
            <p className="m-0 text-meta text-ink-soft">
              {program.subtitle}
              {program.stream ? ` · ${program.stream}` : ""}
            </p>
          </div>
          <StatusChip status={program.status} />
        </div>

        <h3 className="m-0 mb-3 font-display text-[clamp(22px,2.6vw,30px)] leading-[1.08] font-semibold tracking-[-0.035em] text-navy">
          <Link href={`/programs/${program.slug}`} className="no-underline hover:underline">
            {program.title}
          </Link>
        </h3>

        <p className="m-0 mb-5 line-clamp-3 text-sm leading-relaxed text-ink-muted">
          {program.about.lead}
        </p>

        <dl className="m-0 grid grid-cols-2 gap-x-4 gap-y-3 text-meta">
          <div>
            <dt className="m-0 text-ink-faint">Даты</dt>
            <dd className="m-0 font-medium text-ink">
              {formatDateRange(program.startDate, program.endDate)}
            </dd>
          </div>
          <div>
            <dt className="m-0 text-ink-faint">Длительность</dt>
            <dd className="m-0 font-medium text-ink">
              {days} {days === 1 ? "день" : days < 5 ? "дня" : "дней"}
            </dd>
          </div>
          <div>
            <dt className="m-0 text-ink-faint">Место</dt>
            <dd className="m-0 font-medium text-ink">{program.location}</dd>
          </div>
          <div>
            <dt className="m-0 text-ink-faint">Статус</dt>
            <dd className="m-0 font-medium text-ink">{relativeToStart(program)}</dd>
          </div>
        </dl>

        <div className="mt-auto flex flex-wrap gap-2.5 pt-7">
          <ButtonLink href={`/programs/${program.slug}`} size="sm">
            Открыть программу
          </ButtonLink>
        </div>
      </div>
    </article>
  );
}
