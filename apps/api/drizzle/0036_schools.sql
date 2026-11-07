CREATE TYPE "public"."club_kind" AS ENUM('club', 'school');--> statement-breakpoint
CREATE TYPE "public"."sport" AS ENUM('football');--> statement-breakpoint
CREATE TABLE "venue" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"club_id" uuid NOT NULL,
	"name" text NOT NULL,
	"address" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "venue_clubId_name_unique" UNIQUE("club_id","name")
);
--> statement-breakpoint
ALTER TABLE "club" ADD COLUMN "kind" "club_kind" DEFAULT 'club' NOT NULL;--> statement-breakpoint
ALTER TABLE "club" ADD COLUMN "sport" "sport" DEFAULT 'football' NOT NULL;--> statement-breakpoint
ALTER TABLE "club_signup_code" ADD COLUMN "kind" "club_kind" DEFAULT 'club' NOT NULL;--> statement-breakpoint
ALTER TABLE "team" ADD COLUMN "birth_year_from" smallint;--> statement-breakpoint
ALTER TABLE "team" ADD COLUMN "birth_year_to" smallint;--> statement-breakpoint
ALTER TABLE "team" ADD COLUMN "venue_id" uuid;--> statement-breakpoint
ALTER TABLE "venue" ADD CONSTRAINT "venue_club_id_club_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."club"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_venue_id_venue_id_fk" FOREIGN KEY ("venue_id") REFERENCES "public"."venue"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_birth_years" CHECK (("team"."birth_year_from" is null) = ("team"."birth_year_to" is null) and ("team"."birth_year_from" is null or "team"."birth_year_from" <= "team"."birth_year_to"));