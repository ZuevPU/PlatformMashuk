import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";

export function SiteFooter() {
  return (
    <footer className="mesh py-14">
      <div className="wrap flex flex-col items-start justify-between gap-8 md:flex-row md:items-center">
        <div className="flex flex-col gap-5">
          <BrandLogo variant="fullWhite" width={170} />
          <p className="max-w-132.5 text-meta leading-relaxed text-white/66">
            Цифровая экосистема сопровождения слушателей АНО «Центр знаний «Машук».
            Программы, материалы, общение и обратная связь — в одном месте.
          </p>
        </div>

        <div className="flex flex-col items-start gap-4 text-meta text-white/66 md:items-end">
          <p className="m-0 font-display text-lg font-semibold tracking-[-0.02em] text-white">
            Знания на высоте
          </p>
          <p className="m-0">Учим тех, кто учит</p>
          <Link
            href="/#top"
            className="no-underline transition-colors duration-200 hover:text-white"
          >
            Наверх ↑
          </Link>
        </div>
      </div>
    </footer>
  );
}
