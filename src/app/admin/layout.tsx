import type { Metadata } from "next";
import type { ReactNode } from "react";
import Link from "next/link";
import { LogOut } from "lucide-react";
import { requireAdminArea } from "@/lib/admin";
import { logoutAction } from "@/lib/auth-actions";
import { hasDatabase } from "@/lib/db/client";

export const metadata: Metadata = {
  title: { default: "Управление", template: "%s · Управление" },
  robots: { index: false, follow: false },
};

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  if (!hasDatabase()) {
    return (
      <section className="section">
        <div className="wrap max-w-180">
          <h1 className="section-title">Управление недоступно</h1>
          <p className="lead">Админка работает с базой данных. Подключите PostgreSQL — см. ЗАПУСК.md.</p>
        </div>
      </section>
    );
  }

  const user = await requireAdminArea();

  return (
    <div className="min-h-[70vh] bg-paper-warm pb-16">
      <div className="border-b border-[var(--line)] bg-white">
        <div className="flex min-h-14 flex-wrap items-center gap-x-6 gap-y-2 px-4 py-2 text-meta md:px-8">
          <Link href="/admin" className="font-display text-lead font-semibold tracking-[-0.02em] text-navy no-underline">
            Управление программами
          </Link>
          <span className="text-ink-faint">
            {user.member.name}
            {user.isCenterAdmin ? ", администратор Центра" : ""}
          </span>
          <form action={logoutAction} className="ml-auto">
            <button
              type="submit"
              className="inline-flex min-h-9 cursor-pointer items-center gap-2 rounded-full px-3 font-semibold text-navy hover:bg-sky-tint focus-visible:outline-2 focus-visible:outline-navy"
            >
              <LogOut size={14} />
              Выйти
            </button>
          </form>
        </div>
      </div>
      <main className="pt-8">{children}</main>
    </div>
  );
}
