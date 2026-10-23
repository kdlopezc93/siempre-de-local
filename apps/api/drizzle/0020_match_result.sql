CREATE TABLE "match_rating" (
	"match_id" uuid NOT NULL,
	"player_user_id" uuid NOT NULL,
	"rating" smallint NOT NULL,
	"note" text,
	"rated_by" uuid,
	"rated_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_rating_match_id_player_user_id_pk" PRIMARY KEY("match_id","player_user_id"),
	CONSTRAINT "match_rating_range" CHECK ("match_rating"."rating" between 1 and 5)
);
--> statement-breakpoint
ALTER TABLE "team" ADD COLUMN "match_ratings_visible_to_players" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "team_match" ADD COLUMN "goals_for" smallint;--> statement-breakpoint
ALTER TABLE "team_match" ADD COLUMN "goals_against" smallint;--> statement-breakpoint
ALTER TABLE "team_match" ADD COLUMN "figure_player_id" uuid;--> statement-breakpoint
ALTER TABLE "team_match" ADD COLUMN "result_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "match_rating" ADD CONSTRAINT "match_rating_match_id_team_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."team_match"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_rating" ADD CONSTRAINT "match_rating_player_user_id_user_id_fk" FOREIGN KEY ("player_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_rating" ADD CONSTRAINT "match_rating_rated_by_user_id_fk" FOREIGN KEY ("rated_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "match_rating_player_user_id_index" ON "match_rating" USING btree ("player_user_id");--> statement-breakpoint
ALTER TABLE "team_match" ADD CONSTRAINT "team_match_figure_player_id_user_id_fk" FOREIGN KEY ("figure_player_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "team_match" ADD CONSTRAINT "team_match_goals_range" CHECK ("team_match"."goals_for" between 0 and 99 and "team_match"."goals_against" between 0 and 99);