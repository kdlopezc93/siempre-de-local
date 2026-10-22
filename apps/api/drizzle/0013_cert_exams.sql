CREATE TYPE "public"."cert_exam_end" AS ENUM('submit', 'abandon', 'timeout');--> statement-breakpoint
CREATE TYPE "public"."cert_exam_status" AS ENUM('in_progress', 'submitted', 'void');--> statement-breakpoint
CREATE TYPE "public"."knowledge_band" AS ENUM('mastery', 'solid', 'developing', 'insufficient');--> statement-breakpoint
CREATE TABLE "cert_exam" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"team_id" uuid,
	"bank_version_id" uuid NOT NULL,
	"position" "position_code" NOT NULL,
	"status" "cert_exam_status" DEFAULT 'in_progress' NOT NULL,
	"started_at" timestamp with time zone NOT NULL,
	"deadline_at" timestamp with time zone NOT NULL,
	"next_attempt_at" timestamp with time zone NOT NULL,
	"submitted_at" timestamp with time zone,
	"ended_by" "cert_exam_end",
	"score" smallint,
	"total" smallint,
	"pct" numeric(4, 3),
	"band" "knowledge_band",
	"by_area" jsonb,
	"under_review" boolean DEFAULT false NOT NULL,
	"superseded_at" timestamp with time zone
);
--> statement-breakpoint
CREATE TABLE "cert_exam_item" (
	"exam_id" uuid NOT NULL,
	"item_id" uuid NOT NULL,
	"shown_order" smallint NOT NULL,
	"option_order" uuid[] NOT NULL,
	"answer_option_id" uuid,
	"answered_at" timestamp with time zone,
	CONSTRAINT "cert_exam_item_exam_id_item_id_pk" PRIMARY KEY("exam_id","item_id")
);
--> statement-breakpoint
ALTER TABLE "cert_exam" ADD CONSTRAINT "cert_exam_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cert_exam" ADD CONSTRAINT "cert_exam_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cert_exam" ADD CONSTRAINT "cert_exam_bank_version_id_cert_bank_version_id_fk" FOREIGN KEY ("bank_version_id") REFERENCES "public"."cert_bank_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cert_exam_item" ADD CONSTRAINT "cert_exam_item_exam_id_cert_exam_id_fk" FOREIGN KEY ("exam_id") REFERENCES "public"."cert_exam"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cert_exam_item" ADD CONSTRAINT "cert_exam_item_item_id_cert_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."cert_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cert_exam_item" ADD CONSTRAINT "cert_exam_item_answer_option_id_cert_option_id_fk" FOREIGN KEY ("answer_option_id") REFERENCES "public"."cert_option"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cert_exam_user_id_position_started_at_index" ON "cert_exam" USING btree ("user_id","position","started_at" DESC NULLS LAST);--> statement-breakpoint
CREATE INDEX "cert_exam_team_id_index" ON "cert_exam" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cert_exam_one_in_progress" ON "cert_exam" USING btree ("user_id") WHERE "cert_exam"."status" = 'in_progress';