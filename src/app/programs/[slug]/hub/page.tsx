import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { HubApp } from "@/components/hub/HubApp";
import type { HubSection } from "@/components/hub/HubApp";
import { ButtonLink } from "@/components/ui/Button";
import { getProgram } from "@/lib/data";
import { hasDatabase } from "@/lib/db/client";
import { getHubAccess, loadHubParts } from "@/lib/hub-data";
import { formatDateRange, programStatus } from "@/lib/dates";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}

/** Хаб показывает живые данные конкретного участника — страница не кешируется. */
export const dynamic = "force-dynamic";

const SECTIONS: HubSection[] = ["channel", "schedule", "build", "chats", "members", "polls"];

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const program = await getProgram(slug);

  return {
    title: program ? `Рабочее пространство «${program.title}»` : "Рабочее пространство",
    robots: { index: false, follow: false },
  };
}

export default async function ProgramHubPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { tab } = await searchParams;

  if (!hasDatabase()) return <NoDatabase slug={slug} />;

  const program = await getProgram(slug);
  if (!program) notFound();

  // Рабочее пространство закрыто: сначала вход по паролю
  const access = await getHubAccess(slug);
  if (!access) redirect(`/programs/${slug}/enter`);

  const initial = await loadHubParts(access);

  return (
    <HubApp
      program={{
        slug: program.slug,
        title: program.title,
        subtitle: program.subtitle,
        stream: program.stream,
        status: programStatus(program),
        season: program.season,
        dates: formatDateRange(program.startDate, program.endDate),
        location: program.location,
        participants: program.participants,
        materialsCount: program.materials.length,
        days: program.days,
        hasBuild: Boolean(program.hasBuild),
        landing: program.landing,
      }}
      initial={initial}
      session={{ memberId: access.memberId, name: access.name, role: access.role }}
      initialSection={SECTIONS.includes(tab as HubSection) ? (tab as HubSection) : "channel"}
    />
  );
}

function NoDatabase({ slug }: { slug: string }) {
  return (
    <section className="section">
      <div className="wrap max-w-190">
        <p className="eyebrow">Рабочее пространство</p>
        <h1 className="section-title">Нужна база данных</h1>
        <p className="lead mb-8">
          Канал, чаты и опросы хранятся в базе и доступны участникам по паролю.
          Подключите PostgreSQL (переменная DATABASE_URL) — инструкция в ЗАПУСК.md.
        </p>
        <ButtonLink href={`/programs/${slug}`} variant="outline">
          К странице программы
        </ButtonLink>
      </div>
    </section>
  );
}
