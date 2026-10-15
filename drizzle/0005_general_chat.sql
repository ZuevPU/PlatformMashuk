ALTER TABLE "conversations" ADD COLUMN "auto_join" boolean DEFAULT false NOT NULL;--> statement-breakpoint
-- У каждой программы появляется общий чат со всем составом
INSERT INTO "conversations" ("id", "program_id", "kind", "title", "topic", "emoji", "auto_join", "created_by", "created_at")
SELECT 'conv-general-' || p."id", p."id", 'group', 'Общий чат программы', 'Все участники программы', '💬', true, pm."member_id", now()
FROM "programs" p
JOIN LATERAL (
  SELECT "member_id" FROM "program_members" WHERE "program_id" = p."id"
  ORDER BY ("role" = 'participant'), "member_id" LIMIT 1
) pm ON true
WHERE NOT EXISTS (SELECT 1 FROM "conversations" c WHERE c."program_id" = p."id" AND c."auto_join");--> statement-breakpoint
INSERT INTO "conversation_members" ("conversation_id", "member_id")
SELECT c."id", pm."member_id"
FROM "conversations" c
JOIN "program_members" pm ON pm."program_id" = c."program_id"
WHERE c."auto_join"
ON CONFLICT DO NOTHING;
