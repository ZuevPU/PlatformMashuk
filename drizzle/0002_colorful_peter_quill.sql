ALTER TABLE "invites" DROP CONSTRAINT "invites_program_id_programs_id_fk";
--> statement-breakpoint
DROP INDEX "invites_contact_idx";--> statement-breakpoint
ALTER TABLE "invites" ALTER COLUMN "program_id" DROP NOT NULL;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_program_id_programs_id_fk" FOREIGN KEY ("program_id") REFERENCES "public"."programs"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "invites" ADD CONSTRAINT "invites_contact_unique" UNIQUE("contact");