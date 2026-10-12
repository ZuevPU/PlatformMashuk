import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { ButtonLink } from "@/components/ui/Button";

const NAV = [
  { href: "/#programs", label: "Программы" },
  { href: "/#how", label: "Как это работает" },
  { href: "/#archive", label: "Архив" },
];

export function SiteHeader() {
  return (
    <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-[rgba(247,246,242,0.9)] backdrop-blur-[18px]">
      <div className="wrap flex min-h-[76px] items-center gap-8">
        <Link href="/" aria-label="На главную" className="flex shrink-0 items-center">
          <BrandLogo width={156} priority />
        </Link>

        <nav
          aria-label="Основная навигация"
          className="ml-auto hidden items-center gap-6 text-sm md:flex"
        >
          {NAV.map((item) => (
            <Link
              key={item.href}
              href={item.href}
              className="no-underline transition-colors duration-200 hover:text-navy"
            >
              {item.label}
            </Link>
          ))}
        </nav>

        <ButtonLink href="/join" className="ml-auto md:ml-0" size="sm">
          Войти по приглашению
        </ButtonLink>
      </div>
    </header>
  );
}
