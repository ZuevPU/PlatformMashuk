import { ButtonLink } from "@/components/ui/Button";
import { MountainLine } from "@/components/brand/MountainLine";

export default function NotFound() {
  return (
    <section className="mesh relative flex min-h-[70vh] items-center pt-25 pb-25">
      <div className="wrap relative">
        <p className="eyebrow eyebrow--light">Страница не найдена</p>
        <h1 className="m-0 mb-7 max-w-190 font-display text-[clamp(40px,6vw,84px)] leading-[0.94] font-semibold tracking-[-0.065em] text-white">
          Такой страницы
          <span className="block text-sky-light">здесь нет</span>
        </h1>
        <p className="lead lead--light mb-9 max-w-160">
          Возможно, программа завершилась и переехала в архив, или ссылка была скопирована
          не полностью.
        </p>
        <div className="flex flex-wrap gap-3">
          <ButtonLink href="/" variant="light">
            Вернуться к программам
          </ButtonLink>
          <ButtonLink href="/#archive" variant="ghost">
            Открыть архив
          </ButtonLink>
        </div>
      </div>
      <MountainLine className="text-white" />
    </section>
  );
}
