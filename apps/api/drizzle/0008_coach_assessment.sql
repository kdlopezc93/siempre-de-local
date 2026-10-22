CREATE TABLE "coach_assessment" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"team_id" uuid NOT NULL,
	"player_user_id" uuid NOT NULL,
	"coach_user_id" uuid,
	"primary_position" "position_code" NOT NULL,
	"secondary_positions" "position_code"[] DEFAULT '{}' NOT NULL,
	"confidence" smallint NOT NULL,
	"blind" boolean NOT NULL,
	"notes" text,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "coach_assessment_confidence" CHECK ("coach_assessment"."confidence" between 1 and 5),
	CONSTRAINT "coach_assessment_secondary" CHECK (cardinality("coach_assessment"."secondary_positions") <= 2)
);
--> statement-breakpoint
ALTER TABLE "coach_assessment" ADD CONSTRAINT "coach_assessment_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_assessment" ADD CONSTRAINT "coach_assessment_player_user_id_user_id_fk" FOREIGN KEY ("player_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "coach_assessment" ADD CONSTRAINT "coach_assessment_coach_user_id_user_id_fk" FOREIGN KEY ("coach_user_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "coach_assessment_team_id_player_user_id_created_at_index" ON "coach_assessment" USING btree ("team_id","player_user_id","created_at" DESC NULLS LAST);