CREATE TABLE "match_attendance" (
	"match_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"marked_by" uuid,
	"marked_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "match_attendance_match_id_user_id_pk" PRIMARY KEY("match_id","user_id")
);
--> statement-breakpoint
ALTER TABLE "team_match" ADD COLUMN "attendance_taken_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "match_attendance" ADD CONSTRAINT "match_attendance_match_id_team_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."team_match"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_attendance" ADD CONSTRAINT "match_attendance_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "match_attendance" ADD CONSTRAINT "match_attendance_marked_by_user_id_fk" FOREIGN KEY ("marked_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;