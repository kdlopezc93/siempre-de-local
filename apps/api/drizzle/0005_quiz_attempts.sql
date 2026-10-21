CREATE TYPE "public"."attempt_phase" AS ENUM('position', 'prep');--> statement-breakpoint
CREATE TYPE "public"."attempt_status" AS ENUM('in_progress', 'submitted', 'scored', 'void');--> statement-breakpoint
CREATE TABLE "attempt_answer" (
	"attempt_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"option_id" uuid NOT NULL,
	"answered_at" timestamp with time zone NOT NULL,
	CONSTRAINT "attempt_answer_attempt_id_item_id_pk" PRIMARY KEY("attempt_id","item_id")
);
--> statement-breakpoint
CREATE TABLE "attempt_item" (
	"attempt_id" uuid NOT NULL,
	"phase" "attempt_phase" NOT NULL,
	"item_id" uuid NOT NULL,
	"shown_order" smallint NOT NULL,
	"option_order" uuid[] NOT NULL,
	CONSTRAINT "attempt_item_attempt_id_phase_item_id_pk" PRIMARY KEY("attempt_id","phase","item_id")
);
--> statement-breakpoint
CREATE TABLE "attempt_result" (
	"attempt_id" uuid NOT NULL,
	"scoring_version" text NOT NULL,
	"winner" "position_code" NOT NULL,
	"ranking" jsonb NOT NULL,
	"prep_score" smallint NOT NULL,
	"prep_total" smallint NOT NULL,
	"is_official" boolean NOT NULL,
	"computed_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "attempt_result_attempt_id_scoring_version_pk" PRIMARY KEY("attempt_id","scoring_version")
);
--> statement-breakpoint
CREATE TABLE "quiz_attempt" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"client_attempt_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"team_id" uuid,
	"questionnaire_version_id" uuid NOT NULL,
	"format" "match_format" NOT NULL,
	"status" "attempt_status" NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone NOT NULL,
	"received_at" timestamp with time zone DEFAULT now() NOT NULL,
	"void_reason" text,
	CONSTRAINT "quiz_attempt_userId_clientAttemptId_unique" UNIQUE("user_id","client_attempt_id")
);
--> statement-breakpoint
ALTER TABLE "attempt_answer" ADD CONSTRAINT "attempt_answer_attempt_id_quiz_attempt_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."quiz_attempt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_item" ADD CONSTRAINT "attempt_item_attempt_id_quiz_attempt_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."quiz_attempt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "attempt_result" ADD CONSTRAINT "attempt_result_attempt_id_quiz_attempt_id_fk" FOREIGN KEY ("attempt_id") REFERENCES "public"."quiz_attempt"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempt" ADD CONSTRAINT "quiz_attempt_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempt" ADD CONSTRAINT "quiz_attempt_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "quiz_attempt" ADD CONSTRAINT "quiz_attempt_questionnaire_version_id_questionnaire_version_id_fk" FOREIGN KEY ("questionnaire_version_id") REFERENCES "public"."questionnaire_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "quiz_attempt_user_id_submitted_at_index" ON "quiz_attempt" USING btree ("user_id","submitted_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "quiz_attempt_team_id_status_index" ON "quiz_attempt" USING btree ("team_id","status");