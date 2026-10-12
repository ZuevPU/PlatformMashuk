import type { Metadata } from "next";
import { ButtonLink } from "@/components/ui/Button";
import { MountainLine } from "@/components/brand/MountainLine";
import { JoinForm } from "@/components/site/JoinForm";
import { getSessionUser } from "@/lib/auth";
import { hasDatabase } from "@/lib/db/client";
import { LogOut } from "lucide-react";

export const metadata: Metadata = {
  title: "Вход в программу",
  description:
    "Как слушатель попадает в рабочее пространство программы Центра знаний «Машук».",
};

/** Страница читает сессию из cookie — рендерится при каждом запросе. */
export const dynamic = "force-dynamic";

const STEPS = [
  {
    title: "Персональная ссылка",
    text: "После формирования списка участников каждому слушателю приходит персональная ссылка-приглашение. Открывается один раз — и доступ к программе уже выдан.",
  },
  {
    title: "Код на почту",
    text: "Если ссылка потерялась, вход восстанавливается по адресу электронной почты: приходит одноразовый код, пароль запоминать не нужно.",
  },
  {
    title: "Код по SMS",
    text: "Для тех, кому удобнее телефон: вход по номеру и одноразовому коду в SMS. Номер используется только для входа и служебных уведомлений.",
  },
];

export default async function JoinPage() {
  const session = await getSessionUser();
  const authEnabled = hasDatabase();

  return (
    <>
      <section className="mesh relative pt-[84px] pb-[76px]">
        <div className="wrap relative">
          <p className="eyebrow eyebrow--light">Сопровождение программы</p>
          <h1 className="m-0 mb-7 max-w-[880px] font-display text-[clamp(40px,6vw,82px)] leading-[0.94] font-semibold tracking-[-0.065em] text-white">
            Вход в программу
          </h1>
          <p className="lead lead--light max-w-[700px]">
            Витрина программ открыта всем. Рабочее пространство программы — канал,
            обсуждения, живые опросы и материалы — доступно её участникам.
          </p>
          <div className="mt-9 flex flex-wrap gap-3">
            <ButtonLink href="/#programs" variant="light">
              К программам
            </ButtonLink>
          </div>
        </div>
        <MountainLine className="text-white" />
      </section>

      <section className="section">
        <div className="wrap">
          <div className="mb-11 max-w-[780px]">
            <p className="eyebrow">Три способа войти</p>
            <h2 className="section-title">Без паролей и лишних шагов</h2>
            <p className="lead">
              Слушатели приходят на программу на три дня — вход должен занимать секунды,
              а не требовать регистрации.
            </p>
          </div>

          <div className="grid gap-[18px] md:grid-cols-3">
            {STEPS.map((step, index) => (
              <article key={step.title} className="card p-7">
                <span className="card-num mb-6 block" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <h3 className="m-0 mb-2.5 font-display text-xl font-semibold tracking-[-0.02em] text-navy">
                  {step.title}
                </h3>
                <p className="m-0 text-sm leading-relaxed text-ink-soft">{step.text}</p>
              </article>
            ))}
          </div>

          <div className="mt-12">
            {session ? (
              <div className="mb-4 flex flex-wrap items-center gap-4 rounded-[26px] border border-[var(--line)] bg-white p-6">
                <span className="text-[14px] text-ink-soft">
                  Вы вошли как <b className="text-ink">{session.member.name}</b>
                  {session.member.position ? ` · ${session.member.position}` : ""}
                </span>
                <form action="/api/auth/logout" method="post" className="ml-auto">
                  <button
                    type="submit"
                    className="inline-flex min-h-10 cursor-pointer items-center gap-2 rounded-full border border-[var(--line)] bg-white px-4 text-[13px] font-semibold text-navy transition-all duration-200 ease-brand hover:-translate-y-0.5"
                  >
                    <LogOut size={14} />
                    Выйти
                  </button>
                </form>
              </div>
            ) : null}

            <JoinForm authEnabled={authEnabled} />
          </div>
        </div>
      </section>
    </>
  );
}
