"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, FileText, LayoutTemplate, Settings2, Users } from "lucide-react";
import type { LucideIcon } from "lucide-react";

/** Разделы программы в админке: боковым меню на широком экране, лентой — на телефоне. */
export function AdminTabs({ slug }: { slug: string }) {
  const pathname = usePathname();
  const base = `/admin/programs/${slug}`;
  const tabs: { href: string; label: string; Icon: LucideIcon }[] = [
    { href: base, label: "Основное", Icon: Settings2 },
    { href: `${base}/schedule`, label: "Расписание", Icon: CalendarDays },
    { href: `${base}/materials`, label: "Материалы", Icon: FileText },
    { href: `${base}/people`, label: "Доступ и участники", Icon: Users },
    { href: `${base}/build`, label: "Сборка", Icon: LayoutTemplate },
  ];

  return (
    <nav
      aria-label="Разделы программы"
      className="card flex-row gap-1 overflow-x-auto p-1.5 [scrollbar-width:none] lg:sticky lg:top-24 lg:flex-col lg:overflow-visible lg:p-2"
    >
      {tabs.map((tab) => {
        const active = pathname === tab.href;
        return (
          <Link
            key={tab.href}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={[
              "flex shrink-0 items-center gap-2.5 rounded-field px-3.5 py-2.5 text-meta font-semibold whitespace-nowrap no-underline transition-colors duration-150 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-navy",
              active ? "bg-navy text-white" : "text-ink-soft hover:bg-sky-tint hover:text-navy",
            ].join(" ")}
          >
            <tab.Icon size={16} />
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
