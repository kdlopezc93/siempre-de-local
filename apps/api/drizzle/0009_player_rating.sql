CREATE TYPE "public"."rating_attribute_group" AS ENUM('outfield', 'goalkeeper');--> statement-breakpoint
CREATE TYPE "public"."rating_source" AS ENUM('manual', 'field_test');--> statement-breakpoint
CREATE TABLE "player_rating" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"team_id" uuid NOT NULL,
	"player_user_id" uuid NOT NULL,
	"rated_by" uuid,
	"rated_at" timestamp with time zone DEFAULT now() NOT NULL,
	"source" "rating_source" DEFAULT 'manual' NOT NULL,
	"notes" text
);
--> statement-breakpoint
CREATE TABLE "player_rating_value" (
	"rating_id" uuid NOT NULL,
	"attribute_code" text NOT NULL,
	"value" smallint NOT NULL,
	CONSTRAINT "player_rating_value_rating_id_attribute_code_pk" PRIMARY KEY("rating_id","attribute_code"),
	CONSTRAINT "player_rating_value_range" CHECK ("player_rating_value"."value" between 0 and 99)
);
--> statement-breakpoint
CREATE TABLE "rating_attribute" (
	"code" text PRIMARY KEY NOT NULL,
	"name_es" text NOT NULL,
	"group" "rating_attribute_group" NOT NULL
);
--> statement-breakpoint
ALTER TABLE "player_rating" ADD CONSTRAINT "player_rating_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_rating" ADD CONSTRAINT "player_rating_player_user_id_user_id_fk" FOREIGN KEY ("player_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_rating" ADD CONSTRAINT "player_rating_rated_by_user_id_fk" FOREIGN KEY ("rated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_rating_value" ADD CONSTRAINT "player_rating_value_rating_id_player_rating_id_fk" FOREIGN KEY ("rating_id") REFERENCES "public"."player_rating"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "player_rating_value" ADD CONSTRAINT "player_rating_value_attribute_code_rating_attribute_code_fk" FOREIGN KEY ("attribute_code") REFERENCES "public"."rating_attribute"("code") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "player_rating_team_id_player_user_id_rated_at_index" ON "player_rating" USING btree ("team_id","player_user_id","rated_at" DESC NULLS LAST);