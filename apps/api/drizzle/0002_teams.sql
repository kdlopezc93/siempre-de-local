CREATE TYPE "public"."match_format" AS ENUM('F8', 'F11');--> statement-breakpoint
CREATE TYPE "public"."club_role" AS ENUM('owner', 'admin');--> statement-breakpoint
CREATE TYPE "public"."team_role" AS ENUM('coach', 'assistant', 'player');--> statement-breakpoint
CREATE TABLE "club" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"name" text NOT NULL,
	"slug" text NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "club_slug_unique" UNIQUE("slug")
);
--> statement-breakpoint
CREATE TABLE "club_membership" (
	"club_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "club_role" NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "club_membership_club_id_user_id_pk" PRIMARY KEY("club_id","user_id")
);
--> statement-breakpoint
CREATE TABLE "team" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"club_id" uuid NOT NULL,
	"name" text NOT NULL,
	"format" "match_format" NOT NULL,
	"season" text NOT NULL,
	"ratings_visible_to_players" boolean DEFAULT true NOT NULL,
	"archived_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "team_clubId_name_season_unique" UNIQUE("club_id","name","season")
);
--> statement-breakpoint
CREATE TABLE "team_membership" (
	"team_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"role" "team_role" NOT NULL,
	"jersey_number" smallint,
	"joined_at" timestamp with time zone DEFAULT now() NOT NULL,
	"left_at" timestamp with time zone,
	CONSTRAINT "team_membership_team_id_user_id_role_pk" PRIMARY KEY("team_id","user_id","role")
);
--> statement-breakpoint
ALTER TABLE "club_membership" ADD CONSTRAINT "club_membership_club_id_club_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."club"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_membership" ADD CONSTRAINT "club_membership_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_club_id_club_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."club"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_membership" ADD CONSTRAINT "team_membership_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_membership" ADD CONSTRAINT "team_membership_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "club_membership_user_id_index" ON "club_membership" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "team_membership_user_id_index" ON "team_membership" USING btree ("user_id");