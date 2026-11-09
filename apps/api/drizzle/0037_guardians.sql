CREATE TYPE "public"."guardian_relationship" AS ENUM('mother', 'father', 'guardian');--> statement-breakpoint
CREATE TABLE "guardianship" (
	"guardian_user_id" uuid NOT NULL,
	"minor_user_id" uuid NOT NULL,
	"relationship" "guardian_relationship" NOT NULL,
	"authorization_version" text NOT NULL,
	"authorized_at" timestamp with time zone DEFAULT now() NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "guardianship_guardian_user_id_minor_user_id_pk" PRIMARY KEY("guardian_user_id","minor_user_id")
);
--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "managed" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "user" ADD COLUMN "birth_year" smallint;--> statement-breakpoint
ALTER TABLE "invitation" ADD COLUMN "for_guardians" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "guardianship" ADD CONSTRAINT "guardianship_guardian_user_id_user_id_fk" FOREIGN KEY ("guardian_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "guardianship" ADD CONSTRAINT "guardianship_minor_user_id_user_id_fk" FOREIGN KEY ("minor_user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "guardianship_minor_user_id_index" ON "guardianship" USING btree ("minor_user_id");--> statement-breakpoint
ALTER TABLE "invitation" ADD CONSTRAINT "invitation_guardians_player" CHECK (not "invitation"."for_guardians" or "invitation"."role" = 'player');