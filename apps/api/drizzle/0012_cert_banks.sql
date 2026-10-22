CREATE TYPE "public"."cert_bank_status" AS ENUM('draft', 'published', 'retired');--> statement-breakpoint
CREATE TYPE "public"."cert_item_kind" AS ENUM('text', 'pitch_situation');--> statement-breakpoint
CREATE TABLE "cert_area" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"position" "position_code" NOT NULL,
	"code" text NOT NULL,
	"name" text NOT NULL,
	CONSTRAINT "cert_area_position_code_unique" UNIQUE("position","code")
);
--> statement-breakpoint
CREATE TABLE "cert_bank_version" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"position" "position_code" NOT NULL,
	"label" text NOT NULL,
	"status" "cert_bank_status" DEFAULT 'draft' NOT NULL,
	"items_per_exam" smallint NOT NULL,
	"time_limit_s" integer NOT NULL,
	"attempt_interval_days" integer NOT NULL,
	"min_items_to_publish" smallint NOT NULL,
	"difficulty_mix" jsonb NOT NULL,
	"retired_for_quality" boolean DEFAULT false NOT NULL,
	"reviewed_by" text NOT NULL,
	"reviewed_on" date NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "cert_bank_version_position_label_unique" UNIQUE("position","label")
);
--> statement-breakpoint
CREATE TABLE "cert_item" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"bank_version_id" uuid NOT NULL,
	"code" text NOT NULL,
	"area_id" uuid NOT NULL,
	"difficulty" smallint NOT NULL,
	"kind" "cert_item_kind" DEFAULT 'text' NOT NULL,
	"text" text NOT NULL,
	"diagram" jsonb,
	"explanation" text NOT NULL,
	"sort" smallint NOT NULL,
	CONSTRAINT "cert_item_bankVersionId_code_unique" UNIQUE("bank_version_id","code"),
	CONSTRAINT "cert_item_difficulty" CHECK ("cert_item"."difficulty" between 1 and 3)
);
--> statement-breakpoint
CREATE TABLE "cert_option" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"item_id" uuid NOT NULL,
	"label" text NOT NULL,
	"is_correct" boolean NOT NULL,
	"sort" smallint NOT NULL
);
--> statement-breakpoint
ALTER TABLE "cert_item" ADD CONSTRAINT "cert_item_bank_version_id_cert_bank_version_id_fk" FOREIGN KEY ("bank_version_id") REFERENCES "public"."cert_bank_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cert_item" ADD CONSTRAINT "cert_item_area_id_cert_area_id_fk" FOREIGN KEY ("area_id") REFERENCES "public"."cert_area"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "cert_option" ADD CONSTRAINT "cert_option_item_id_cert_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."cert_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "cert_bank_version_one_published" ON "cert_bank_version" USING btree ("position") WHERE "cert_bank_version"."status" = 'published';--> statement-breakpoint
CREATE INDEX "cert_item_bank_version_id_index" ON "cert_item" USING btree ("bank_version_id");--> statement-breakpoint
CREATE INDEX "cert_option_item_id_index" ON "cert_option" USING btree ("item_id");--> statement-breakpoint
CREATE UNIQUE INDEX "cert_option_one_correct" ON "cert_option" USING btree ("item_id") WHERE "cert_option"."is_correct";