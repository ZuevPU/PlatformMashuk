import type { Metadata } from "next";
import type { CSSProperties } from "react";
import { redirect } from "next/navigation";
import { CalendarClock, SearchX } from "lucide-react";
import { ButtonLink } from "@/components/ui/Button";
import { MountainLine } from "@/components/brand/MountainLine";
import { PollJoin } from "@/components/polls/PollJoin";
import { hasDatabase } from "@/lib/db/client";
import { getViewer } from "@/lib/auth";
import { findPollSession, loadMembers, loadPollData } from "@/lib/db/queries";
import { getProgram } from "@/lib/data";
import { seasonStyle } from "@/lib/brand";
import type { SeasonKey } from "@/lib/types";

interface PageProps {
  params: Promise<{ code: string }>;
}

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Опрос",
  robots: { index: false, follow: false },
};

export default async function PollJoinPage({ params }: PageProps) {
  const { code } = await params;

  if (!hasDatabase()) return <Notice title="Опросы работают с базой данных" />;

  const target = await findPollSession(code);
  if (!target) return <Notice code={code} notFound />;

  // Вход открыт только участникам программы: иначе — на страницу входа,
  // и после неё человек вернётся ровно к этому опросу.
  const viewer = await getViewer(target.programSlug);
  if (!viewer) {
    redirect(`/programs/${target.programSlug}/enter?next=/poll/${encodeURIComponent(code)}`);
  }

  // Сессию грузим напрямую по id (даже черновик): участник пришёл по ссылке
  // и должен увидеть состояние «опрос ещё не начался», а не «не найдено».
  const pollData = await loadPollData(
    viewer.programId,
    target.programSlug,
    { id: viewer.user.member.id, staff: true },
    target.sessionId,
  );
  const session = pollData.sessions.find((item) => item.id === target.sessionId);
  const poll = session ? pollData.polls.find((item) => item.id === session.pollId) : undefined;
  if (!session || !poll) return <Notice code={code} notFound />;

  const [program, members] = await Promise.all([
    getProgram(target.programSlug),
    loadMembers(viewer.programId),
  ]);

  const season: SeasonKey = program?.season ?? "autumn";

  return (
    <div data-season={season} style={seasonStyle(season) as CSSProperties} className="bg-paper-warm">
      <PollJoin
        programSlug={target.programSlug}
        programTitle={program?.title ?? "Программа"}
        poll={poll}
        session={session}
        members={members}
        currentUser={{
          id: viewer.user.member.id,
          name: viewer.user.member.name,
          role: viewer.role,
        }}
      />
    </div>
  );
}

function Notice({
  title,
  code,
  notFound = false,
}: {
  title?: string;
  code?: string;
  notFound?: boolean;
}) {
  return (
    <section className="mesh relative min-h-dvh pt-24 pb-20">
      <div className="wrap relative max-w-150">
        <span className="mb-5 grid size-12 place-items-center rounded-full bg-white/15 text-white">
          {notFound ? <SearchX size={22} /> : <CalendarClock size={22} />}
        </span>
        <h1 className="m-0 mb-5 max-w-180 font-display text-[clamp(30px,4.4vw,52px)] leading-[1] font-semibold tracking-[-0.05em] text-white">
          {notFound ? `Опрос ${code ? `с кодом ${code}` : ""} не найден` : title}
        </h1>
        <p className="lead lead--light mb-8 max-w-150">
          {notFound
            ? "Проверьте код с экрана ведущего. Если опрос завершился, ссылка уже не действует."
            : "Опросы и квизы хранятся в базе. Подключите PostgreSQL — инструкция в ЗАПУСК.md."}
        </p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/poll" variant="light">
            Ввести код ещё раз
          </ButtonLink>
          <ButtonLink href="/" variant="ghost">
            На главную
          </ButtonLink>
        </div>
      </div>
      <MountainLine className="text-white" />
    </section>
  );
}
