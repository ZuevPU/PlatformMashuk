import Link from "next/link";
import { Plus } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { listManagedPrograms } from "@/lib/admin";
import { formatDateRange, programSeason } from "@/lib/dates";
import { SEASONS } from "@/lib/brand";
import type { SeasonKey } from "@/lib/types";

export const metadata = { title: "Программы" };

export default async function AdminHome() {
  const user = (await getSessionUser())!;
  const programs = await listManagedPrograms(user);

  return (
    <div className="wrap flex flex-col gap-6">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1 className="m-0 font-display text-[clamp(28px,3.4vw,40px)] leading-tight font-semibold tracking-[-0.045em] text-navy">
          Программы
        </h1>
        {user.isCenterAdmin && (
          <Link
            href="/admin/programs/new"
            className="inline-flex min-h-11 items-center gap-2 rounded-full bg-navy px-5 text-ui font-semibold text-white no-underline transition-colors duration-150 hover:bg-navy-deep focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy"
          >
            <Plus size={16} />
            Новая программа
          </Link>
        )}
      </div>

      {programs.length === 0 ? (
        <p className="m-0 rounded-soft border border-[var(--line)] bg-white px-6 py-5 text-ui text-ink-soft">
          Программ пока нет. Создайте первую — у неё появятся страница, расписание и закрытое
          рабочее пространство для участников.
        </p>
      ) : (
        <ul className="m-0 flex list-none flex-col gap-3 p-0">
          {programs.map((program) => {
            const season =
              SEASONS[programSeason({ startDate: program.startDate, season: (program.season as SeasonKey | null) ?? undefined })];
            return (
              <li key={program.id}>
                <Link
                  href={`/admin/programs/${program.slug}`}
                  className="group grid gap-4 rounded-panel border border-[var(--line)] bg-white p-5 no-underline transition-colors duration-150 hover:border-navy/30 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy md:grid-cols-[6px_minmax(0,1fr)_auto] md:items-center"
                >
                  <span className="hidden h-full min-h-12 rounded-full md:block" style={{ background: season.accent }} aria-hidden="true" />
                  <span className="min-w-0">
                    <span className="block text-meta text-ink-soft">{program.subtitle}</span>
                    <span className="block font-display text-title font-semibold tracking-[-0.03em] text-navy group-hover:underline">
                      {program.title}
                    </span>
                    <span className="mt-1 block text-meta text-ink-soft">
                      {formatDateRange(program.startDate, program.endDate)}
                    </span>
                  </span>
                  <span className="flex flex-wrap gap-2 text-caption">
                    <Badge on>{program.members} в составе</Badge>
                    <Badge on={program.hasPassword}>{program.hasPassword ? "Вход по паролю открыт" : "Пароль не задан"}</Badge>
                    <Badge on={program.hasBuild}>{program.hasBuild ? "Сборка загружена" : "Без сборки"}</Badge>
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function Badge({ on, children }: { on: boolean; children: React.ReactNode }) {
  return (
    <span className={`rounded-full px-3 py-1.5 ${on ? "bg-sky-tint text-sky-ink" : "bg-paper-warm text-ink-faint"}`}>
      {children}
    </span>
  );
}
