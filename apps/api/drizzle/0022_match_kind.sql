CREATE TYPE "public"."match_kind" AS ENUM('championship', 'friendly', 'training');--> statement-breakpoint
CREATE TABLE "tournament" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"team_id" uuid NOT NULL,
	"name" text NOT NULL,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "team_match" ALTER COLUMN "opponent" DROP NOT NULL;--> statement-breakpoint
-- Los partidos de antes son de campeonato (Kevin, 2026-10-28); el torneo se les asigna después.
ALTER TABLE "team_match" ADD COLUMN "kind" "match_kind" DEFAULT 'championship' NOT NULL;--> statement-breakpoint
ALTER TABLE "team_match" ALTER COLUMN "kind" DROP DEFAULT;--> statement-breakpoint
ALTER TABLE "team_match" ADD COLUMN "tournament_id" uuid;--> statement-breakpoint
ALTER TABLE "tournament" ADD CONSTRAINT "tournament_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "tournament" ADD CONSTRAINT "tournament_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "tournament_team_name_unique" ON "tournament" USING btree ("team_id",lower("name"));--> statement-breakpoint
ALTER TABLE "team_match" ADD CONSTRAINT "team_match_tournament_id_tournament_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournament"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_match" ADD CONSTRAINT "team_match_kind_fields" CHECK (("team_match"."kind" = 'training') = ("team_match"."opponent" is null)
        and ("team_match"."tournament_id" is null or "team_match"."kind" = 'championship')
        and ("team_match"."kind" <> 'training' or "team_match"."goals_for" is null));