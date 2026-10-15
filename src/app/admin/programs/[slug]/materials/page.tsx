import { loadProgram } from "@/lib/db/queries";
import { MaterialsEditor } from "@/components/admin/MaterialsEditor";
import { Panel } from "@/components/admin/ui";

export const metadata = { title: "Материалы" };

export default async function AdminMaterialsPage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const program = await loadProgram(slug);
  if (!program) return null;

  return (
    <Panel
      title="Материалы"
      description="Презентации, записи и тексты по дням — ссылками на общую папку, облако или файлы сборки."
    >
      <MaterialsEditor slug={slug} materials={program.materials} dayCount={program.days.length} />
    </Panel>
  );
}
