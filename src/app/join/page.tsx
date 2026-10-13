import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ButtonLink } from "@/components/ui/Button";
import { MountainLine } from "@/components/brand/MountainLine";
import { LoginForm } from "@/components/auth/AuthForms";
import { getSessionUser, homeFor } from "@/lib/auth";
import { hasDatabase } from "@/lib/db/client";

export const metadata: Metadata = {
  title: "Вход",
  description: "Вход в рабочее пространство программы Центра знаний «Машук».",
  robots: { index: false, follow: false },
};

/** Страница читает сессию из cookie — рендерится при каждом запросе. */
export const dynamic = "force-dynamic";

const STEPS = [
  {
    title: "Впервые на программе",
    text: "Откройте страницу программы и нажмите «Войти в программу». Введите пароль программы от организаторов, представьтесь и придумайте личный пароль.",
  },
  {
    title: "Уже участник",
    text: "Входите по своей почте или телефону и личному паролю — здесь или на странице программы. Вход работает на любом устройстве.",
  },
  {
    title: "Забыли пароль",
    text: "Напишите организаторам: администратор выдаст новый пароль, старый перестанет работать сразу на всех устройствах.",
  },
];

export default async function JoinPage({
  searchParams,
}: {
  searchParams: Promise<{ next?: string }>;
}) {
  const { next } = await searchParams;
  const session = await getSessionUser();
  if (session) redirect(await homeFor(session.member.id, session.isCenterAdmin));

  return (
    <>
      <section className="mesh relative pt-21 pb-19">
        <div className="wrap relative">
          <p className="eyebrow eyebrow--light">Сопровождение программы</p>
          <h1 className="m-0 mb-7 max-w-220 font-display text-[clamp(40px,6vw,82px)] leading-[0.94] font-semibold tracking-[-0.065em] text-white">
            Вход
          </h1>
          <p className="lead lead--light max-w-175">
            Страница программы открыта всем. Рабочее пространство — канал, чаты, живые опросы
            и сборка программы — доступно только участникам.
          </p>
        </div>
        <MountainLine className="text-white" />
      </section>

      <section className="section">
        <div className="wrap grid gap-10 lg:grid-cols-[minmax(0,440px)_1fr] lg:items-start">
          <div className="card p-7 md:p-8">
            <h2 className="m-0 mb-1.5 font-display text-title-lg font-semibold tracking-[-0.03em] text-navy">
              Личный вход
            </h2>
            <p className="m-0 mb-6 text-meta leading-relaxed text-ink-soft">
              Почта или телефон и пароль, который вы задали при первом входе или получили
              от организаторов.
            </p>
            {hasDatabase() ? (
              <LoginForm next={next} />
            ) : (
              <p className="m-0 rounded-field bg-sky-tint px-4 py-3 text-meta text-sky-ink">
                Вход появится после подключения базы данных.
              </p>
            )}
          </div>

          <div className="grid gap-4.5">
            {STEPS.map((step, index) => (
              <article key={step.title} className="card flex-row gap-5 p-6">
                <span className="card-num shrink-0" aria-hidden="true">
                  {String(index + 1).padStart(2, "0")}
                </span>
                <div>
                  <h3 className="m-0 mb-1.5 font-display text-lg font-semibold tracking-[-0.02em] text-navy">
                    {step.title}
                  </h3>
                  <p className="m-0 text-sm leading-relaxed text-ink-soft">{step.text}</p>
                </div>
              </article>
            ))}
            <div>
              <ButtonLink href="/#programs" variant="outline">
                К программе
              </ButtonLink>
            </div>
          </div>
        </div>
      </section>
    </>
  );
}
