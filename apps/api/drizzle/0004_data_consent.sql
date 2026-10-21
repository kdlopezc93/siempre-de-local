CREATE TABLE "data_consent" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"user_id" uuid NOT NULL,
	"policy_version" text NOT NULL,
	"accepted_at" timestamp with time zone DEFAULT now() NOT NULL,
	"revoked_at" timestamp with time zone,
	"age_confirmed" boolean NOT NULL,
	CONSTRAINT "data_consent_age_confirmed" CHECK ("data_consent"."age_confirmed")
);
--> statement-breakpoint
ALTER TABLE "data_consent" ADD CONSTRAINT "data_consent_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "data_consent_user_id_index" ON "data_consent" USING btree ("user_id");