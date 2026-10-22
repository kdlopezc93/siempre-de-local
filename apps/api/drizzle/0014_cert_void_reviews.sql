CREATE TYPE "public"."cert_review_status" AS ENUM('pending', 'completed', 'expired', 'cancelled');--> statement-breakpoint
CREATE TABLE "cert_review_request" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"team_id" uuid NOT NULL,
	"player_user_id" uuid NOT NULL,
	"position" "position_code" NOT NULL,
	"requested_by" uuid,
	"reason" text NOT NULL,
	"requested_at" timestamp with time zone DEFAULT now() NOT NULL,
	"due_at" timestamp with time zone NOT NULL,
	"status" "cert_review_status" DEFAULT 'pending' NOT NULL,
	"resolved_exam_id" uuid,
	"closed_at" timestamp with time zone
);
--> statement-breakpoint
ALTER TABLE "cert_exam" ADD COLUMN "review_request_id" uuid;--> statement-breakpoint
ALTER TABLE "cert_exam" ADD COLUMN "void_reason" text;--> statement-breakpoint
ALTER TABLE "cert_exam" ADD COLUMN "voided_by" uuid;--> statement-breakpoint
ALTER TABLE "cert_exam" ADD COLUMN "voided_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "cert_exam" ADD COLUMN "void_resets_interval" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "cert_review_request" ADD CONSTRAINT "cert_review_request_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cert_review_request" ADD CONSTRAINT "cert_review_request_player_user_id_user_id_fk" FOREIGN KEY ("player_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cert_review_request" ADD CONSTRAINT "cert_review_request_requested_by_user_id_fk" FOREIGN KEY ("requested_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cert_review_request" ADD CONSTRAINT "cert_review_request_resolved_exam_id_cert_exam_id_fk" FOREIGN KEY ("resolved_exam_id") REFERENCES "public"."cert_exam"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "cert_review_request_team_id_index" ON "cert_review_request" USING btree ("team_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cert_review_request_one_open" ON "cert_review_request" USING btree ("player_user_id","position") WHERE "cert_review_request"."status" in ('pending', 'expired');--> statement-breakpoint
ALTER TABLE "cert_exam" ADD CONSTRAINT "cert_exam_voided_by_user_id_fk" FOREIGN KEY ("voided_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;