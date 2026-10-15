ALTER TABLE "poll_responses" ADD COLUMN "hidden" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "poll_responses" ADD COLUMN "answered" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "polls" ADD COLUMN "team_count" integer DEFAULT 0 NOT NULL;