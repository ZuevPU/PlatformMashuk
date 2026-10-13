import type { ReactNode } from "react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { ArrowLeft, ExternalLink } from "lucide-react";
import { requireProgramStaff } from "@/lib/admin";
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
  await requireProgramStaff(slug);
  const program = await loadProgram(slug);
  if (!program) notFound();
  const season = SEASONS[program.season];

  return (
    <div className="flex flex-col gap-6">
      <Link href="/admin" className="inline-flex w-fit items-center gap-2 text-meta font-medium text-ink-soft no-underline hover:text-navy">
        <ArrowLeft size={14} />
        Все программы
      </Link>

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
      </header>

      <div className="grid gap-6 lg:grid-cols-[248px_minmax(0,1fr)] lg:items-start">
        <AdminTabs slug={slug} />
        <div className="min-w-0">{children}</div>
      </div>
    </div>
  );
}
