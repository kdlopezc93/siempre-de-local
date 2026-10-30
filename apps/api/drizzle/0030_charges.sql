CREATE TYPE "public"."charge_kind" AS ENUM('registration', 'referee', 'vaca', 'fee', 'fine', 'uniform', 'other');--> statement-breakpoint
CREATE TYPE "public"."charge_split" AS ENUM('per_person', 'total');--> statement-breakpoint
CREATE TYPE "public"."payment_method" AS ENUM('cash', 'nequi', 'daviplata', 'transfer', 'other');--> statement-breakpoint
CREATE TYPE "public"."payment_status" AS ENUM('reported', 'confirmed', 'rejected');--> statement-breakpoint
CREATE TABLE "charge" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"team_id" uuid NOT NULL,
	"kind" charge_kind NOT NULL,
	"title" text,
	"match_id" uuid,
	"tournament_id" uuid,
	"split" charge_split NOT NULL,
	"amount" integer NOT NULL,
	"due_on" date,
	"created_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"cancelled_at" timestamp with time zone,
	CONSTRAINT "charge_amount_range" CHECK ("charge"."amount" between 1 and 100000000),
	CONSTRAINT "charge_match_or_tournament" CHECK ("charge"."match_id" is null or "charge"."tournament_id" is null)
);
--> statement-breakpoint
CREATE TABLE "charge_share" (
	"charge_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"note" text,
	CONSTRAINT "charge_share_charge_id_user_id_pk" PRIMARY KEY("charge_id","user_id"),
	CONSTRAINT "charge_share_amount_range" CHECK ("charge_share"."amount" between 0 and 100000000)
);
--> statement-breakpoint
CREATE TABLE "payment" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"charge_id" uuid NOT NULL,
	"user_id" uuid NOT NULL,
	"amount" integer NOT NULL,
	"method" "payment_method" NOT NULL,
	"paid_on" date NOT NULL,
	"status" "payment_status" NOT NULL,
	"reported_by" uuid,
	"reviewed_by" uuid,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"reviewed_at" timestamp with time zone,
	CONSTRAINT "payment_amount_range" CHECK ("payment"."amount" between 1 and 100000000)
);
--> statement-breakpoint
ALTER TABLE "charge" ADD CONSTRAINT "charge_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge" ADD CONSTRAINT "charge_match_id_team_match_id_fk" FOREIGN KEY ("match_id") REFERENCES "public"."team_match"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge" ADD CONSTRAINT "charge_tournament_id_tournament_id_fk" FOREIGN KEY ("tournament_id") REFERENCES "public"."tournament"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge" ADD CONSTRAINT "charge_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_share" ADD CONSTRAINT "charge_share_charge_id_charge_id_fk" FOREIGN KEY ("charge_id") REFERENCES "public"."charge"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "charge_share" ADD CONSTRAINT "charge_share_user_id_user_id_fk" FOREIGN KEY ("user_id") REFERENCES "public"."user"("id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_reported_by_user_id_fk" FOREIGN KEY ("reported_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_reviewed_by_user_id_fk" FOREIGN KEY ("reviewed_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "payment" ADD CONSTRAINT "payment_charge_id_user_id_charge_share_charge_id_user_id_fk" FOREIGN KEY ("charge_id","user_id") REFERENCES "public"."charge_share"("charge_id","user_id") ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "charge_team_id_created_at_index" ON "charge" USING btree ("team_id","created_at");--> statement-breakpoint
CREATE INDEX "charge_share_user_id_index" ON "charge_share" USING btree ("user_id");--> statement-breakpoint
CREATE INDEX "payment_charge_id_index" ON "payment" USING btree ("charge_id");