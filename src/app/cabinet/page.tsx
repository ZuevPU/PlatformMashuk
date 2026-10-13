import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { eq } from "drizzle-orm";
import { CabinetForm } from "@/components/site/CabinetForm";
import { getSessionUser } from "@/lib/auth";
import { getDb, hasDatabase, schema } from "@/lib/db/client";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Личный кабинет",
  robots: { index: false, follow: false },
};

interface PageProps {
  searchParams: Promise<{ error?: string }>;
}

export default async function CabinetPage({ searchParams }: PageProps) {
  const { error } = await searchParams;

  if (!hasDatabase()) redirect("/join");
  const user = await getSessionUser();
  if (!user) redirect("/join?next=/cabinet");

  const db = getDb()!;
  const [profile] = await db
    .select({
      name: schema.members.name,
      contact: schema.members.contact,
      position: schema.members.position,
      org: schema.members.org,
      city: schema.members.city,
    })
    .from(schema.members)
    .where(eq(schema.members.id, user.member.id));

  const programs = await db
    .select({
      slug: schema.programs.slug,
      title: schema.programs.title,
      role: schema.programMembers.role,
    })
    .from(schema.programMembers)
    .innerJoin(schema.programs, eq(schema.programs.id, schema.programMembers.programId))
    .where(eq(schema.programMembers.memberId, user.member.id));

  return (
    <CabinetForm
      profile={{
        name: profile?.name ?? user.member.name,
        contact: profile?.contact ?? "",
        position: profile?.position ?? "",
        org: profile?.org ?? "",
        city: profile?.city ?? "",
      }}
      programs={programs}
      isCenterAdmin={user.isCenterAdmin}
      adminError={error === "admin"}
    />
  );
}
