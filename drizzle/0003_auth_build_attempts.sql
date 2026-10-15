CREATE TABLE "login_attempts" (
	"key" text PRIMARY KEY NOT NULL,
	"attempts" integer DEFAULT 0 NOT NULL,
	"window_start" timestamp with time zone DEFAULT now() NOT NULL,
	"blocked_until" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "contact" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "password_hash" text;--> statement-breakpoint
ALTER TABLE "members" ADD COLUMN "created_at" timestamp with time zone DEFAULT now() NOT NULL;--> statement-breakpoint
ALTER TABLE "poll_responses" ADD COLUMN "respondent_key" text;--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "access_password_hash" text;--> statement-breakpoint
ALTER TABLE "programs" ADD COLUMN "build_uploaded_at" timestamp with time zone;--> statement-breakpoint
CREATE INDEX "conversation_members_member_idx" ON "conversation_members" USING btree ("member_id");--> statement-breakpoint
CREATE INDEX "conversations_program_idx" ON "conversations" USING btree ("program_id");--> statement-breakpoint
CREATE INDEX "poll_sessions_poll_idx" ON "poll_sessions" USING btree ("poll_id");--> statement-breakpoint
CREATE INDEX "program_members_member_idx" ON "program_members" USING btree ("member_id");--> statement-breakpoint
-- Контакты из приглашений переезжают к участникам: теперь это логин
UPDATE "members" AS m SET "contact" = i."contact"
FROM (SELECT DISTINCT ON ("member_id") "member_id", "contact" FROM "invites"
      WHERE "contact" IS NOT NULL ORDER BY "member_id", "created_at" DESC) AS i
WHERE m."id" = i."member_id";--> statement-breakpoint
ALTER TABLE "members" ADD CONSTRAINT "members_contact_unique" UNIQUE("contact");--> statement-breakpoint
ALTER TABLE "poll_responses" ADD CONSTRAINT "poll_responses_respondent_key" UNIQUE("session_id","question_id","respondent_key");