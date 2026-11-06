CREATE TYPE "public"."card_color" AS ENUM('yellow', 'red');--> statement-breakpoint
CREATE TABLE "match_card" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"match_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"color" "card_color" NOT NULL
);
--> statement-breakpoint
CREATE TABLE "match_goal" (
	"match_id" uuid NOT NULL,
	"seq" smallint NOT NULL,
	"scorer_id" uuid,
	"assist_id" uuid,
	"own_goal" boolean DEFAULT false NOT NULL,
	CONSTRAINT "match_goal_match_id_seq_pk" PRIMARY KEY("match_id","seq"),
	CONSTRAINT "match_goal_seq" CHECK ("match_goal"."seq" between 1 and 99),
	CONSTRAINT "match_goal_own" CHECK (not "match_goal"."own_goal" or ("match_goal"."scorer_id" is null and "match_goal"."assist_id" is null)),
	CONSTRAINT "match_goal_not_self" CHECK ("match_goal"."assist_id" is null or "match_goal"."assist_id" <> "match_goal"."scorer_id")
);
--> statement-breakpoint
ALTER TABLE "match_card" ADD CONSTRAINT "match_card_match_id_team_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."team_match"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_card" ADD CONSTRAINT "match_card_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_goal" ADD CONSTRAINT "match_goal_match_id_team_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."team_match"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_goal" ADD CONSTRAINT "match_goal_scorer_id_user_id_fk" FOREIGN KEY ("scorer_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_goal" ADD CONSTRAINT "match_goal_assist_id_user_id_fk" FOREIGN KEY ("assist_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "match_card_match_id_index" ON "match_card" USING btree ("match_id");--> statement-breakpoint
CREATE INDEX "match_card_user_id_index" ON "match_card" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "match_goal_scorer_id_index" ON "match_goal" USING btree ("scorer_id");--> statement-breakpoint
CREATE INDEX "match_goal_assist_id_index" ON "match_goal" USING btree ("assist_id");