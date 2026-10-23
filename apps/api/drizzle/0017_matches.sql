-- Partidos convocados y la respuesta de cada jugador (Fase 7).
CREATE TYPE "public"."match_reply_value" AS ENUM('yes', 'no');--> statement-breakpoint
CREATE TYPE "public"."match_status" AS ENUM('scheduled', 'cancelled');--> statement-breakpoint
CREATE TABLE "match_reply" (
	"match_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"reply" "match_reply_value" NOT NULL,
	"replied_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_reply_match_id_user_id_pk" PRIMARY KEY("match_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "team_match" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"team_id" uuid NOT NULL,
	"created_by" uuid,
	"format" "match_format" NOT NULL,
	"starts_at" timestamp with time zone NOT NULL,
	"place" text NOT NULL,
	"opponent" text NOT NULL,
	"status" "match_status" DEFAULT 'scheduled' NOT NULL,
	"lineup_id" uuid,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "match_reply" ADD CONSTRAINT "match_reply_match_id_team_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."team_match"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_reply" ADD CONSTRAINT "match_reply_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_match" ADD CONSTRAINT "team_match_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_match" ADD CONSTRAINT "team_match_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_match" ADD CONSTRAINT "team_match_lineup_id_lineup_id_fk" FOREIGN KEY ("lineup_id") REFERENCES "public"."lineup"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "team_match_team_id_starts_at_index" ON "team_match" USING btree ("team_id","starts_at");