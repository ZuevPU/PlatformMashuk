CREATE TABLE "qa_votes" (
	"response_id" text NOT NULL,
	"member_id" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "qa_votes_response_id_member_id_pk" PRIMARY KEY("response_id","member_id")
);
--> statement-breakpoint
ALTER TABLE "qa_votes" ADD CONSTRAINT "qa_votes_response_id_poll_responses_id_fk" FOREIGN KEY ("response_id") REFERENCES "public"."poll_responses"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "qa_votes" ADD CONSTRAINT "qa_votes_member_id_members_id_fk" FOREIGN KEY ("member_id") REFERENCES "public"."members"("id") ON DELETE cascade ON UPDATE no action;