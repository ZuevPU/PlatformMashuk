import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { getProgramStats, requireProgramStaff } from "@/lib/admin";
import { loadProgram } from "@/lib/db/queries";
import { formatDateRange } from "@/lib/dates";
import { SEASONS } from "@/lib/brand";
import { AdminTabs } from "@/components/admin/AdminTabs";

export default async function AdminProgramLayout({
  children,
  params,
}: {
  children: ReactNode;
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const staff = await requireProgramStaff(slug);
  const program = await loadProgram(slug);
  if (!program) notFound();
  const season = SEASONS[program.season];
  const stats = await getProgramStats(staff.programId);

  return (
    <div className="lg:grid lg:grid-cols-[264px_minmax(0,1fr)]">
      {/* Боковое меню прижато к левому краю окна */}
      <aside className="border-b border-[var(--line)] bg-white px-4 py-4 md:px-8 lg:sticky lg:top-14 lg:h-[calc(100vh-3.5rem)] lg:overflow-y-auto lg:border-r lg:border-b-0 lg:px-5 lg:py-6">
        <Link
          href="/admin"
          className="mb-4 inline-flex items-center gap-2 text-meta font-medium text-ink-soft no-underline hover:text-navy"
        >
          <ArrowLeft size={14} />
          Все программы
        </Link>
        <AdminTabs slug={slug} />
      </aside>

      <div className="min-w-0 px-4 py-6 md:px-8">
        <header className="relative overflow-hidden rounded-3xl border border-[var(--line)] bg-white p-6 pl-8 md:p-8 md:pl-10">
          {/* Полоса сезона — цвет программы по брендбуку */}
          <span className="absolute inset-y-0 left-0 w-2" style={{ background: season.accent }} aria-hidden="true" />
          <p className="m-0 text-meta text-ink-soft">
            {program.subtitle} · {formatDateRange(program.startDate, program.endDate)} · {program.location}
          </p>
          <h1 className="m-0 mt-1 font-display text-[clamp(28px,3.6vw,44px)] leading-[1.02] font-semibold tracking-[-0.05em] text-navy">
            {program.title}
          </h1>
          <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2 text-meta font-semibold">
            <Link href={`/programs/${slug}`} className="inline-flex items-center gap-1.5 text-navy" target="_blank">
              Страница программы
              <ExternalLink size={13} />
            </Link>
            <Link href={`/programs/${slug}/hub`} className="inline-flex items-center gap-1.5 text-navy">
              Рабочее пространство: чат и опросы
            </Link>
          </div>

          <div className="mt-3 flex flex-wrap gap-x-4 gap-y-1 text-meta text-ink-faint">
            <span>{stats.posts} постов</span>
            <span>{stats.comments} комментариев</span>
            <span>{stats.members} участников</span>
          </div>
        </header>

        <div className="mt-6">{children}</div>
      </div>
    </div>
  );
}
