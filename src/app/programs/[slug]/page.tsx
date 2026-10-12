import type { CSSProperties } from "react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { MountainLine } from "@/components/brand/MountainLine";
import { DaySchedule } from "@/components/programs/DaySchedule";
import { StatusChip } from "@/components/programs/StatusChip";
import { getProgram } from "@/lib/data";
import { SEASONS } from "@/lib/brand";
import { DIRECTIONS } from "@/lib/types";
import { durationDays, formatDateRange, relativeToStart } from "@/lib/dates";

interface PageProps {
  params: Promise<{ slug: string }>;
}

/**
 * Страница читает данные из базы при каждом запросе: содержимое программы
 * меняется (материалы, расписание), поэтому статическая генерация не подходит.
 */
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

  const season = SEASONS[program.season];
  const direction = DIRECTIONS.find((item) => item.key === program.direction);
  const days = durationDays(program.startDate, program.endDate);

  const seasonVars = {
    "--accent": season.accent,
    "--accent-strong": season.strong,
  } as CSSProperties;

  return (
    <div data-season={program.season} style={seasonVars}>
      {/* ---------------------------------------------------------------- HERO */}
      <section className="mesh mesh--accent relative pt-[76px] pb-[84px]">
        <div className="wrap relative">
          <nav aria-label="Хлебные крошки" className="mb-9 text-[13px] text-white/66">
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
            <span className="text-[12px] font-semibold tracking-[0.16em] text-sky-light uppercase">
              {direction?.label}
            </span>
            {program.stream && (
              <span className="text-[12px] text-white/60">{program.stream}</span>
            )}
          </div>

          <p className="eyebrow eyebrow--light">{program.subtitle}</p>
          <h1 className="m-0 mb-7 max-w-[900px] font-display text-[clamp(40px,6.4vw,88px)] leading-[0.94] font-semibold tracking-[-0.065em] text-white">
            {program.title}
          </h1>
          <p className="lead lead--light mb-10 max-w-[720px]">{program.hero.lead}</p>

          <div className="flex flex-wrap gap-3">
            <ButtonLink href="#schedule" variant="light">
              Программа по дням
            </ButtonLink>
            <ButtonLink href="#materials" variant="ghost">
              Материалы
            </ButtonLink>
            {program.landing && (
              <ButtonLink href={program.landing.url} variant="ghost" external>
                Итоги программы
              </ButtonLink>
            )}
          </div>

          <div className="mt-14 grid gap-2.5 sm:grid-cols-3">
            {program.hero.facts.map((fact) => (
              <div key={fact.label} className="glass px-5 py-[18px]">
                <b className="mb-1.5 block font-display text-[23px] font-semibold tracking-[-0.02em] text-white">
                  {fact.value}
                </b>
                <span className="text-[13px] leading-snug text-white/72">{fact.label}</span>
              </div>
            ))}
          </div>
        </div>
        <MountainLine className="text-white" />
      </section>

      {/* -------------------------------------------------------- О ПРОГРАММЕ */}
      <section className="section" id="about">
        <div className="wrap grid gap-14 lg:grid-cols-[0.8fr_1.2fr] lg:items-start">
          {program.about.quote ? (
            <aside
              className="mesh mesh--accent rounded-[26px] p-8 lg:sticky lg:top-[110px]"
              style={seasonVars}
            >
              <p className="m-0 font-long text-[25px] leading-[1.45] italic text-white">
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
                  <h3 className="m-0 mb-2 font-display text-[21px] font-semibold tracking-[-0.02em] text-navy">
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
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------- РЕЗУЛЬТАТЫ */}
      {program.results.length > 0 && (
        <section
          className="section relative overflow-hidden bg-black-ink text-white"
          style={{
            backgroundImage:
              "radial-gradient(circle at 18% 0%, rgba(84,164,219,0.2), transparent 58%), radial-gradient(circle at 88% 100%, rgba(162,133,95,0.16), transparent 52%)",
          }}
        >
          <div className="wrap">
            <p className="eyebrow eyebrow--light">Результаты</p>
            <h2 className="section-title section-title--light">Что участники увезли с собой</h2>

            <div className="mt-12 grid gap-3.5 sm:grid-cols-2 xl:grid-cols-4">
              {program.results.map((result, index) => (
                <article
                  key={result.title}
                  className="flex min-h-[250px] flex-col rounded-[22px] border border-white/12 bg-white/[0.045] p-7"
                >
                  <span className="mb-[62px] inline-grid size-10 place-items-center rounded-xl bg-white font-semibold text-navy">
                    {String(index + 1).padStart(2, "0")}
                  </span>
                  <h3 className="m-0 mb-2.5 font-display text-xl font-semibold tracking-[-0.02em]">
                    {result.title}
                  </h3>
                  <p className="m-0 text-sm leading-relaxed text-white/68">{result.text}</p>
                </article>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* --------------------------------------------------------- РАСПИСАНИЕ */}
      {program.days.length > 0 && (
        <section className="section" id="schedule">
          <div className="wrap">
            <div className="mb-11 flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="eyebrow">Программа</p>
                <h2 className="section-title section-title--tight">
                  {days} {days === 1 ? "день" : days < 5 ? "дня" : "дней"} программы
                </h2>
              </div>
              <p className="m-0 max-w-[380px] text-sm leading-relaxed text-ink-soft">
                Блоки, время и эксперты. После завершения программы к каждому блоку
                прикрепляются материалы.
              </p>
            </div>

            <DaySchedule days={program.days} accent={season.accent} />
          </div>
        </section>
      )}

      {/* --------------------------------------------------------- МАТЕРИАЛЫ */}
      {program.materials.length > 0 && (
        <section className="section bg-sky-pale" id="materials">
          <div className="wrap">
            <div className="mb-10 flex flex-wrap items-end justify-between gap-6">
              <div>
                <p className="eyebrow">База знаний</p>
                <h2 className="section-title section-title--tight">Материалы по блокам</h2>
              </div>
              {program.driveFolder && (
                <ButtonLink href={program.driveFolder} external>
                  Вся папка программы
                </ButtonLink>
              )}
            </div>

            <div className="grid gap-[18px] md:grid-cols-2">
              {program.materials.map((material) => (
                <article key={material.id} className="card card--hover min-h-[320px] p-7">
                  <div className="mb-8 flex items-start justify-between gap-5">
                    <span className="text-[11px] font-semibold tracking-[0.14em] text-gold uppercase">
                      День {material.day} · {material.kind}
                    </span>
                    <span className="card-num" aria-hidden="true">
                      {material.id.replace(/\D/g, "").padStart(2, "0")}
                    </span>
                  </div>

                  <h3 className="m-0 mb-3 font-display text-[clamp(22px,2.6vw,30px)] leading-[1.08] font-semibold tracking-[-0.035em] text-navy">
                    {material.title}
                  </h3>

                  {material.description && (
                    <p className="m-0 text-sm leading-relaxed text-ink-muted">
                      {material.description}
                    </p>
                  )}

                  {material.speakers && material.speakers.length > 0 && (
                    <p className="m-0 mt-4 font-semibold text-ink">
                      {material.speakers.join(" · ")}
                    </p>
                  )}

                  <div className="mt-auto flex flex-wrap gap-2.5 pt-7">
                    {material.links.map((link) => (
                      <ButtonLink
                        key={link.url + link.label}
                        href={link.url}
                        size="sm"
                        variant={link.url === "#" ? "outline" : "solid"}
                        external={link.url !== "#"}
                      >
                        {link.label}
                      </ButtonLink>
                    ))}
                  </div>
                </article>
              ))}
            </div>

            {program.note && (
              <p className="mt-7 rounded-[18px] border border-[var(--line)] bg-white/58 px-7 py-6 text-[13px] leading-relaxed text-ink-soft">
                <strong className="text-ink">Важно.</strong> {program.note}
              </p>
            )}
          </div>
        </section>
      )}

      {/* --------------------------------------------------- РАБОЧЕЕ ПРОСТРАНСТВО */}
      <section className="section" id="hub">
        <div className="wrap">
          <div className="mb-12 max-w-[780px]">
            <p className="eyebrow">Сопровождение</p>
            <h2 className="section-title">Рабочее пространство программы</h2>
            <p className="lead">
              Для участников программы открывается закрытая часть: канал с постами команды
              и обсуждением, живые опросы прямо во время блоков и материалы по дням.
            </p>
          </div>

          <div className="grid gap-[18px] md:grid-cols-3">
            <HubCard
              title="Канал программы"
              text="Посты команды Центра, комментарии участников, реакции, закреплённые сообщения и фотографии."
            />
            <HubCard
              title="Живые опросы"
              text="Ведущий запускает вопрос — участники отвечают с телефона. Облако слов, шкалы, квиз с лидербордом."
            />
            <HubCard
              title="Участники и роли"
              text="Слушатели, модераторы и администраторы программы. Модераторы ведут обсуждение и помогают с материалами."
            />
          </div>

          <div className="mt-9 flex flex-wrap items-center gap-4">
            <ButtonLink href={`/programs/${program.slug}/hub`}>Открыть канал программы</ButtonLink>
            <ButtonLink href="/join" variant="outline">
              Как устроен вход
            </ButtonLink>
            <p className="m-0 text-[13px] text-ink-faint">
              Доступ выдаётся персональной ссылкой — её получают слушатели программы.
            </p>
          </div>
        </div>
      </section>

      {/* --------------------------------------------------------------- ИТОГИ */}
      {program.landing && (
        <section className="section pt-0" id="results">
          <div className="wrap">
            <article className="card flex-col items-start gap-7 p-8 md:flex-row md:items-center">
              <div className="min-w-0 flex-1">
                <p className="eyebrow mb-2">Итоги программы</p>
                <h2 className="m-0 mb-2 font-display text-[clamp(24px,3vw,34px)] leading-tight font-semibold tracking-[-0.035em] text-navy">
                  Авторский одностраничник с итогами
                </h2>
                <p className="m-0 max-w-[620px] text-sm leading-relaxed text-ink-soft">
                  Ход программы, ключевые идеи и материалы по дням собраны командой Центра
                  в отдельной странице базы знаний.
                </p>
                {program.landing.code && (
                  <p className="mt-3 mb-0 text-[13px] text-ink-faint">
                    Код доступа для участников:{" "}
                    <b className="tracking-[0.18em] text-ink">{program.landing.code}</b>
                  </p>
                )}
              </div>
              <div className="flex flex-wrap gap-2.5">
                <ButtonLink href={program.landing.url} external>
                  Открыть итоги
                </ButtonLink>
              </div>
            </article>
          </div>
        </section>
      )}
    </div>
  );
}

function Meta({ label, value, wide }: { label: string; value: string; wide?: boolean }) {
  return (
    <div className={wide ? "col-span-2 md:col-span-2" : undefined}>
      <dt className="mb-1 text-[12px] tracking-[0.06em] text-ink-faint uppercase">{label}</dt>
      <dd className="m-0 font-medium text-ink">{value}</dd>
    </div>
  );
}

function HubCard({ title, text }: { title: string; text: string }) {
  return (
    <article className="card p-7">
      <span
        aria-hidden="true"
        className="mb-6 block h-1 w-12 rounded-full"
        style={{ background: "var(--accent)" }}
      />
      <h3 className="m-0 mb-2.5 font-display text-xl font-semibold tracking-[-0.02em] text-navy">
        {title}
      </h3>
      <p className="m-0 text-sm leading-relaxed text-ink-soft">{text}</p>
    </article>
  );
}
