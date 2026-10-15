import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { MountainLine } from "@/components/brand/MountainLine";
import { StatusChip } from "@/components/programs/StatusChip";
import { getProgram } from "@/lib/data";
import { seasonStyle } from "@/lib/brand";
import { DIRECTIONS } from "@/lib/types";
import { durationDays, formatDateRange, relativeToStart } from "@/lib/dates";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const program = await getProgram(slug);

  if (!program) return { title: "Программа не найдена" };

  return {
    title: program.title,
    description: program.hero.lead,
  };
}

export default async function ProgramPage({ params }: PageProps) {
  const { slug } = await params;
  const program = await getProgram(slug);

  if (!program) notFound();

  const direction = DIRECTIONS.find((item) => item.key === program.direction);
  const days = durationDays(program.startDate, program.endDate);
  const seasonVars = seasonStyle(program.season) as CSSProperties;
  const enterHref = `/programs/${program.slug}/enter`;

  return (
    <div data-season={program.season} style={seasonVars}>
      {/* ---------------------------------------------------------------- HERO */}
      <section className="mesh mesh--accent relative pt-19 pb-21">
        <div className="wrap relative">
          <nav aria-label="Хлебные крошки" className="mb-9 text-meta text-white/66">
            <Link href="/" className="no-underline hover:text-white">
              Программы
            </Link>
            <span aria-hidden="true" className="mx-2">
              /
            </span>
            <span>{program.title}</span>
          </nav>

          <div className="mb-6 flex flex-wrap items-center gap-3">
            <StatusChip status={program.status} size="md" />
            <span className="text-caption font-semibold tracking-[0.16em] text-sky-light uppercase">
              {direction?.label}
            </span>
            {program.stream && <span className="text-caption text-white/60">{program.stream}</span>}
          </div>

          <p className="eyebrow eyebrow--light">{program.subtitle}</p>
          <h1 className="m-0 mb-7 max-w-225 font-display text-[clamp(40px,6.4vw,88px)] leading-[0.94] font-semibold tracking-[-0.065em] text-white">
            {program.title}
          </h1>
          <p className="lead lead--light mb-10 max-w-180">{program.hero.lead}</p>

          <div className="flex flex-wrap gap-3">
            <ButtonLink href={enterHref} variant="light">
              Войти в программу
            </ButtonLink>
          </div>

          {program.hero.facts.length > 0 && (
            <div className="mt-14 grid gap-2.5 sm:grid-cols-3">
              {program.hero.facts.map((fact) => (
                <div key={fact.label} className="glass px-5 py-4.5">
                  <b className="mb-1.5 block font-display text-title font-semibold tracking-[-0.02em] text-white">
                    {fact.value}
                  </b>
                  <span className="text-meta leading-snug text-white/72">{fact.label}</span>
                </div>
              ))}
            </div>
          )}
        </div>
        <MountainLine className="text-white" />
      </section>

      {/* -------------------------------------------------------- О ПРОГРАММЕ */}
      <section className="section" id="about">
        <div className="wrap grid gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          {program.about.quote ? (
            <aside
              className="mesh mesh--accent rounded-card p-8 lg:sticky lg:top-27.5"
              style={seasonVars}
            >
              <p className="m-0 font-long text-title-lg leading-[1.45] italic text-white">
                {program.about.quote.text}
              </p>
              <small className="mt-6 block leading-relaxed text-sky-light">
                {program.about.quote.caption}
              </small>
            </aside>
          ) : (
            <div />
          )}

          <div>
            <p className="eyebrow">О программе</p>
            <h2 className="section-title">{program.title}</h2>
            <p className="lead">{program.about.lead}</p>

            <div className="mt-9 grid gap-4">
              {program.about.blocks.map((block) => (
                <article key={block.title} className="card p-7">
                  <h3 className="m-0 mb-2 font-display text-title-sm font-semibold tracking-[-0.02em] text-navy">
                    {block.title}
                  </h3>
                  <p className="m-0 leading-relaxed text-ink-soft">{block.text}</p>
                </article>
              ))}
            </div>

            <dl className="mt-9 grid grid-cols-2 gap-x-6 gap-y-5 border-t border-[var(--line)] pt-7 text-sm md:grid-cols-4">
              <Meta label="Даты" value={formatDateRange(program.startDate, program.endDate)} />
              <Meta label="Длительность" value={`${days} дн.`} />
              <Meta label="Статус" value={relativeToStart(program)} />
              <Meta
                label="Участники"
                value={program.participants ? `${program.participants} чел.` : "по набору"}
              />
              <Meta label="Место" value={program.location} />
              {program.format && <Meta label="Формат" value={program.format} wide />}
            </dl>

            <div className="mt-9">
              <ButtonLink href={enterHref}>Войти в программу</ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </div>
  );
}

function Meta({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2 md:col-span-2" : undefined}>
      <dt className="mb-1 text-caption tracking-[0.06em] text-ink-faint uppercase">{label}</dt>
      <dd className="m-0 font-medium text-ink">{value}</dd>
    </div>
  );
}
