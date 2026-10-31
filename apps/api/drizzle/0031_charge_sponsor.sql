ALTER TABLE "charge_share" ADD COLUMN "sponsor_id" uuid;--> statement-breakpoint
ALTER TABLE "charge_share" ADD COLUMN "team_covers" boolean DEFAULT false NOT NULL;--> statement-breakpoint
ALTER TABLE "charge_share" ADD CONSTRAINT "charge_share_sponsor_id_user_id_fk" FOREIGN KEY ("sponsor_id") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "charge_share_sponsor_id_index" ON "charge_share" USING btree ("sponsor_id");--> statement-breakpoint
ALTER TABLE "charge_share" ADD CONSTRAINT "charge_share_one_sponsor" CHECK (not ("charge_share"."sponsor_id" is not null and "charge_share"."team_covers"));--> statement-breakpoint
ALTER TABLE "charge_share" ADD CONSTRAINT "charge_share_not_self" CHECK ("charge_share"."sponsor_id" is null or "charge_share"."sponsor_id" <> "charge_share"."user_id");