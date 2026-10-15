import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { notFound, redirect } from "next/navigation";
import { CalendarDays, Lock, MapPin } from "lucide-react";
import { MountainLine } from "@/components/brand/MountainLine";
import { EnterProgramForm } from "@/components/auth/AuthForms";
import { getProgram } from "@/lib/data";
import { getSessionUser, getViewer } from "@/lib/auth";
import { hasDatabase } from "@/lib/db/client";
import { formatDateRange } from "@/lib/dates";
import { seasonStyle } from "@/lib/brand";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ next?: string }>;
}

export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const program = await getProgram(slug);
  return {
    title: program ? `Вход в программу «${program.title}»` : "Вход в программу",
    robots: { index: false, follow: false },
  };
}

export default async function EnterProgramPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { next } = await searchParams;
  const program = await getProgram(slug);
  if (!program) notFound();

  // Уже участник — сразу в рабочее пространство (или к опросу, откуда пришли)
  if (hasDatabase() && (await getViewer(slug))) {
    redirect(next && next.startsWith("/") && !next.startsWith("//") ? next : `/programs/${slug}/hub`);
  }

  const session = await getSessionUser();

  return (
    <div
      data-season={program.season}
      style={seasonStyle(program.season) as CSSProperties}
    >
      <section className="mesh mesh--accent relative pt-18 pb-16">
        <div className="wrap relative">
          <p className="eyebrow eyebrow--light">{program.subtitle}</p>
          <h1 className="m-0 mb-6 max-w-220 font-display text-[clamp(36px,5.4vw,72px)] leading-[0.96] font-semibold tracking-[-0.06em] text-white">
            {program.title}
          </h1>
          <ul className="m-0 flex list-none flex-wrap gap-x-6 gap-y-2 p-0 text-ui text-white/85">
            <li className="flex items-center gap-2">
              <CalendarDays size={15} />
              {formatDateRange(program.startDate, program.endDate)}
            </li>
            <li className="flex items-center gap-2">
              <MapPin size={15} />
              {program.location}
            </li>
          </ul>
        </div>
        <MountainLine className="text-white" />
      </section>

      <section className="section">
        <div className="wrap grid gap-10 lg:grid-cols-[minmax(0,520px)_1fr] lg:items-start">
          <div className="card p-7 md:p-8">
            <span className="mb-5 grid size-11 place-items-center rounded-full bg-sky-tint text-navy">
              <Lock size={18} />
            </span>
            <h2 className="m-0 mb-1.5 font-display text-title-lg font-semibold tracking-[-0.03em] text-navy">
              Вход в программу
            </h2>
            <p className="m-0 mb-6 text-meta leading-relaxed text-ink-soft">
              Рабочее пространство закрыто: внутри чат участников, живые опросы,
              расписание и сборка программы.
            </p>
            {hasDatabase() ? (
              <EnterProgramForm slug={slug} signedInAs={session?.member.name} next={next} />
            ) : (
              <p className="m-0 rounded-field bg-sky-tint px-4 py-3 text-meta text-sky-ink">
                Вход появится после подключения базы данных.
              </p>
            )}
          </div>

          <div className="max-w-130 text-ui leading-relaxed text-ink-soft">
            <p className="eyebrow">Как это работает</p>
            <ol className="m-0 grid list-none gap-5 p-0">
              <li>
                <b className="text-ink">Пароль программы</b> выдают организаторы — на регистрации,
                в рассылке или на первом занятии.
              </li>
              <li>
                <b className="text-ink">Личный пароль</b> вы придумываете сами при первом входе.
                Дальше входите по почте или телефону и своему паролю — с любого устройства.
              </li>
              <li>
                <b className="text-ink">Забыли пароль?</b> Организаторы выдадут новый в админке.
              </li>
            </ol>
          </div>
        </div>
      </section>
    </div>
  );
}
