CREATE TABLE "club_signup_code" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"code_hash" text NOT NULL,
	"note" text,
	"created_by" uuid,
	"expires_at" timestamp with time zone NOT NULL,
	"club_id" uuid,
	"used_by" uuid,
	"used_at" timestamp with time zone,
	"revoked_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "club_signup_code_codeHash_unique" UNIQUE("code_hash")
);
--> statement-breakpoint
ALTER TABLE "club_signup_code" ADD CONSTRAINT "club_signup_code_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_signup_code" ADD CONSTRAINT "club_signup_code_club_id_club_id_fk" FOREIGN KEY ("club_id") REFERENCES "public"."club"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "club_signup_code" ADD CONSTRAINT "club_signup_code_used_by_user_id_fk" FOREIGN KEY ("used_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;