"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

/** Разделы программы в админке. Активный — по адресу страницы. */
export function AdminTabs({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/admin/programs/${slug}`;
  const tabs = [
    { href: base, label: "Основное" },
    { href: `${base}/schedule`, label: "Расписание" },
    { href: `${base}/materials`, label: "Материалы" },
    { href: `${base}/people`, label: "Доступ и участники" },
    { href: `${base}/build`, label: "Сборка" },
  ];

  return (
    <nav aria-label="Разделы программы" className="-mx-1 overflow-x-auto">
      <ul className="m-0 flex w-max list-none gap-1 rounded-full bg-white p-1 shadow-[inset_0_0_0_1px_var(--line)]">
        {tabs.map((tab) => {
          const active = pathname === tab.href;
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                aria-current={active ? "page" : undefined}
                className={[
                  "inline-flex min-h-10 items-center rounded-full px-4 text-meta font-semibold whitespace-nowrap no-underline transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy",
                  active ? "bg-navy text-white" : "text-ink-soft hover:bg-sky-tint hover:text-navy",
                ].join(" ")}
              >
                {tab.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
