import { loadProgram } from "@/lib/db/queries";
import { ScheduleEditor } from "@/components/admin/ScheduleEditor";
import { Panel } from "@/components/admin/ui";

export const metadata = { title: "Расписание" };

export default async function AdminSchedulePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const program = await loadProgram(slug);
  if (!program) return null;

  return (
    <Panel
      title="Расписание"
      description="Участники видят его в рабочем пространстве и на странице программы. После сохранения оно обновляется у всех сразу."
    >
      <ScheduleEditor slug={slug} days={program.days} startDate={program.startDate} />
    </Panel>
  );
}
