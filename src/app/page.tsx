import { ButtonLink } from "@/components/ui/Button";
import { MountainLine } from "@/components/brand/MountainLine";
import { ProgramCatalog } from "@/components/programs/ProgramCatalog";
import { getAllPrograms } from "@/lib/data";

export default async function HomePage() {
  const programs = await getAllPrograms();

  return (
    <>
      {/* ---------------------------------------------------------------- HERO */}
      <section className="mesh relative pt-26 pb-20">
        <div className="wrap relative">
          <p className="eyebrow eyebrow--light">Экосистема сопровождения слушателей</p>
          <h1 className="m-0 mb-7 max-w-215 font-display text-[clamp(44px,7.5vw,104px)] leading-[0.92] font-semibold tracking-[-0.07em] text-white">
            Программы
            <span className="block text-sky-light">Центра знаний «Машук»</span>
          </h1>
          <p className="lead lead--light mb-9 max-w-180">
            Программы, материалы, общение участников и живая обратная связь — в одной среде.
            Рабочее пространство программы — для её участников.
          </p>

          <ButtonLink href="#programs" variant="light">
            Смотреть программы
          </ButtonLink>
        </div>
        <MountainLine className="text-white" />
      </section>

      {/* ------------------------------------------------------------- КАТАЛОГ */}
      <section className="section" id="programs">
        <div className="wrap">
          <div className="mb-9">
            <p className="eyebrow">Каталог</p>
            <h2 className="section-title section-title--tight">Наши программы</h2>
          </div>

          <ProgramCatalog programs={programs} />
        </div>
      </section>
    </>
  );
}
