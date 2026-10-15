import { redirect } from "next/navigation";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import { getSessionUser } from "@/lib/auth";
import { ProgramForm } from "@/components/admin/ProgramForm";
import { Panel } from "@/components/admin/ui";

export const metadata = { title: "Новая программа" };

export default async function NewProgramPage() {
  const user = await getSessionUser();
  if (!user?.isCenterAdmin) redirect("/admin");

  return (
    <div className="wrap flex flex-col gap-6">
      <Link href="/admin" className="inline-flex items-center gap-2 text-meta font-medium text-ink-soft no-underline hover:text-navy">
        <ArrowLeft size={14} />
        Все программы
      </Link>
      <Panel
        title="Новая программа"
        description="Сначала главное: название, даты и место. Расписание, материалы, пароль и сборку добавите на следующих вкладках."
      >
        <ProgramForm />
      </Panel>
    </div>
  );
}
