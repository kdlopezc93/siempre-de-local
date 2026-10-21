CREATE TYPE "public"."dominant_foot" AS ENUM('left', 'right', 'both');--> statement-breakpoint
CREATE TABLE "player_preferred_position" (
	"user_id" uuid NOT NULL,
	"position" "position_code" NOT NULL,
	"rank" smallint NOT NULL,
	CONSTRAINT "player_preferred_position_user_id_position_pk" PRIMARY KEY("user_id","position"),
	CONSTRAINT "player_preferred_position_userId_rank_unique" UNIQUE("user_id","rank"),
	CONSTRAINT "player_preferred_position_rank" CHECK ("player_preferred_position"."rank" between 1 and 3)
);
--> statement-breakpoint
CREATE TABLE "player_profile" (
	"user_id" uuid PRIMARY KEY NOT NULL,
	"display_name" text NOT NULL,
	"dominant_foot" "dominant_foot",
	"plays_goalkeeper" boolean DEFAULT false NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "player_preferred_position" ADD CONSTRAINT "player_preferred_position_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_profile" ADD CONSTRAINT "player_profile_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;