import Link from "next/link";
import { BrandLogo } from "@/components/brand/BrandLogo";
import { ButtonLink } from "@/components/ui/Button";
import { getSessionUser, homeFor } from "@/lib/auth";
import { listManagedPrograms } from "@/lib/admin";

const NAV = [
  { href: "/#programs", label: "Программы" },
  { href: "/#how", label: "Как это работает" },
  { href: "/#archive", label: "Архив" },
];

export async function SiteHeader() {
  // Вошедший видит путь к своей программе или к управлению, а не «Войти»
  const user = await getSessionUser();
  let action = { href: "/join", label: "Войти" };
  if (user) {
    const manages = user.isCenterAdmin || (await listManagedPrograms(user)).length > 0;
    action = manages
      ? { href: "/admin", label: "Управление" }
      : { href: await homeFor(user.member.id, false), label: "Моя программа" };
  }

  return (
    <header className="sticky top-0 z-20 border-b border-[var(--line)] bg-paper-warm/90 backdrop-blur-glass">
      <div className="wrap flex min-h-19 items-center gap-8">
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

        <ButtonLink href={action.href} className="ml-auto md:ml-0" size="sm">
          {action.label}
        </ButtonLink>
      </div>
    </header>
  );
}
