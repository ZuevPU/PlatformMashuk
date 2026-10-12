import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { HubApp } from "@/components/hub/HubApp";
import { getProgram } from "@/lib/data";
import { getHub } from "@/lib/hub";
import { getPollData } from "@/lib/polls";
import { getChatData } from "@/lib/chat";
import { getProgramRole, getSessionUser } from "@/lib/auth";
import { formatDateRange, programStatus } from "@/lib/dates";

interface PageProps {
  params: Promise<{ slug: string }>;
  searchParams: Promise<{ tab?: string }>;
}

/** Хаб показывает живые данные: сообщения, ответы на опросы, состав. */
export const dynamic = "force-dynamic";

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  const program = await getProgram(slug);

  return {
    title: program ? `Канал программы «${program.title}»` : "Канал программы",
    description: program
      ? `Рабочее пространство программы: объявления команды, обсуждение участников и материалы.`
      : undefined,
  };
}

export default async function ProgramHubPage({ params, searchParams }: PageProps) {
  const { slug } = await params;
  const { tab } = await searchParams;
  const program = await getProgram(slug);

  if (!program) notFound();

  const hub = await getHub(program);
  const polls = await getPollData(program, hub.members);
  const chat = await getChatData(program, hub.members);

  // Роль берём из сессии: она же определяет права в интерфейсе
  const user = await getSessionUser();
  const programRole = user ? await getProgramRole(user.member.id, program.slug) : null;
  const session =
    user && programRole
      ? { memberId: user.member.id, name: user.member.name, role: programRole }
      : null;

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
        postsCount: hub.posts.length,
      }}
      hub={hub}
      polls={polls}
      chat={chat}
      session={session}
      initialSection={
        tab === "members" ? "members" : tab === "polls" ? "polls" : tab === "chats" ? "chats" : "channel"
      }
    />
  );
}
