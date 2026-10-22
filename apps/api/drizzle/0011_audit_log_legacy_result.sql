CREATE TABLE "audit_log" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"actor_user_id" uuid,
	"action" text NOT NULL,
	"entity" text NOT NULL,
	"entity_id" text NOT NULL,
	"team_id" uuid,
	"at" timestamp with time zone DEFAULT now() NOT NULL,
	"meta" jsonb
);
--> statement-breakpoint
CREATE TABLE "legacy_result" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"team_id" uuid NOT NULL,
	"imported_by" uuid,
	"imported_at" timestamp with time zone DEFAULT now() NOT NULL,
	"player_name" text NOT NULL,
	"player_user_id" uuid,
	"taken_at" timestamp,
	"format" "match_format",
	"winner" "position_code" NOT NULL,
	"affinity_pct" smallint,
	"podium" "position_code"[] NOT NULL,
	"prep_score" smallint,
	"prep_total" smallint,
	"raw" jsonb NOT NULL,
	CONSTRAINT "legacy_result_teamId_playerName_takenAt_winner_unique" UNIQUE NULLS NOT DISTINCT("team_id","player_name","taken_at","winner")
);
--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_actor_user_id_user_id_fk" FOREIGN KEY ("actor_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "audit_log" ADD CONSTRAINT "audit_log_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_result" ADD CONSTRAINT "legacy_result_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_result" ADD CONSTRAINT "legacy_result_imported_by_user_id_fk" FOREIGN KEY ("imported_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "legacy_result" ADD CONSTRAINT "legacy_result_player_user_id_user_id_fk" FOREIGN KEY ("player_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "audit_log_team_id_at_index" ON "audit_log" USING btree ("team_id","at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "audit_log_actor_user_id_at_index" ON "audit_log" USING btree ("actor_user_id","at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "legacy_result_team_id_imported_at_index" ON "legacy_result" USING btree ("team_id","imported_at" DESC NULLS LAST);