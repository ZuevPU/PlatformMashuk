import { eq } from "drizzle-orm";
import { getDb, schema } from "@/lib/db/client";
import { getProgramStaff, listProgramMembers } from "@/lib/admin";
import { MembersPanel, ProgramPasswordPanel } from "@/components/admin/AccessPanels";
import { Panel } from "@/components/admin/ui";

export const metadata = { title: "Доступ и участники" };

export default async function AdminPeoplePage({ params }: { params: Promise<{ slug: string }> }) {
  const { slug } = await params;
  const staff = await getProgramStaff(slug);
  const db = getDb();
  if (!staff || !db) return null;

  const [[program], members] = await Promise.all([
    db
      .select({ hash: schema.programs.accessPasswordHash })
      .from(schema.programs)
      .where(eq(schema.programs.id, staff.programId)),
    listProgramMembers(staff.programId),
  ]);

  return (
    <div className="flex flex-col gap-6">
      <Panel
        title="Пароль программы"
        description="Новый участник вводит его на странице входа, представляется и придумывает личный пароль. Сообщите пароль на регистрации или в рассылке."
      >
        <ProgramPasswordPanel slug={slug} hasPassword={Boolean(program?.hash)} />
      </Panel>
      <Panel
        title="Участники"
        description="Можно добавить человека заранее — система сразу выдаст ему личный пароль. Пароль программы к уже заведённой записи доступа не даёт: так никто не займёт чужое место."
      >
        <MembersPanel
          slug={slug}
          members={members}
          isCenterAdmin={staff.isCenterAdmin}
          selfId={staff.user.member.id}
        />
      </Panel>
    </div>
  );
}
