ALTER TABLE "team" ADD COLUMN "call_up_reminders" boolean DEFAULT true NOT NULL;--> statement-breakpoint
ALTER TABLE "team_match" ADD COLUMN "reminder_eve_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "team_match" ADD COLUMN "reminder_soon_at" timestamp with time zone;--> statement-breakpoint
ALTER TABLE "team_match" ADD COLUMN "reminder_manual_at" timestamp with time zone;