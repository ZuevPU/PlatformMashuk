import { loadProgram } from "@/lib/db/queries";
import { getProgramStaff } from "@/lib/admin";
import { ProgramForm } from "@/components/admin/ProgramForm";
import { DeleteProgram } from "@/components/admin/BuildPanel";
import { Panel } from "@/components/admin/ui";

export const metadata = { title: "Основное" };

export default async function AdminProgramPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const [program, staff] = await Promise.all([loadProgram(slug), getProgramStaff(slug)]);
  if (!program || !staff) return null;

  return (
    <div className="flex flex-col gap-6">
      <Panel title="Основное" description="То, что видно на странице программы и в шапке рабочего пространства.">
        <ProgramForm program={program} />
      </Panel>
      {staff.isCenterAdmin && (
        <Panel title="Удаление программы">
          <DeleteProgram slug={slug} />
        </Panel>
      )}
    </div>
  );
}
