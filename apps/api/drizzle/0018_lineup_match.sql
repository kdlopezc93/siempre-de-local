-- La alineación de un partido (Fase 7): lineup.match_id.
ALTER TABLE "lineup" ADD COLUMN "match_id" uuid;--> statement-breakpoint
ALTER TABLE "lineup" ADD CONSTRAINT "lineup_match_id_team_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."team_match"("id") ON DELETE set null ON UPDATE no action;