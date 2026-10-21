CREATE TYPE "public"."position_code" AS ENUM('POR', 'LAT', 'DFC', 'MCD', 'MC', 'MP', 'EXT', 'DC');--> statement-breakpoint
CREATE TYPE "public"."position_item_context" AS ENUM('situation', 'attribute');--> statement-breakpoint
CREATE TYPE "public"."questionnaire_status" AS ENUM('draft', 'published', 'retired');--> statement-breakpoint
CREATE TABLE "option_weight" (
	"option_id" uuid NOT NULL,
	"position" "position_code" NOT NULL,
	"points" smallint NOT NULL,
	CONSTRAINT "option_weight_option_id_position_pk" PRIMARY KEY("option_id","position"),
	CONSTRAINT "option_weight_points_positive" CHECK ("option_weight"."points" > 0)
);
--> statement-breakpoint
CREATE TABLE "position_item" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"version_id" uuid NOT NULL,
	"code" text NOT NULL,
	"context" "position_item_context" NOT NULL,
	"text" text NOT NULL,
	"sort" smallint NOT NULL,
	CONSTRAINT "position_item_versionId_code_unique" UNIQUE("version_id","code"),
	CONSTRAINT "position_item_versionId_sort_unique" UNIQUE("version_id","sort")
);
--> statement-breakpoint
CREATE TABLE "position_option" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"item_id" uuid NOT NULL,
	"label" text NOT NULL,
	"sort" smallint NOT NULL,
	CONSTRAINT "position_option_itemId_sort_unique" UNIQUE("item_id","sort")
);
--> statement-breakpoint
CREATE TABLE "prep_item" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"version_id" uuid NOT NULL,
	"position" "position_code" NOT NULL,
	"text" text NOT NULL,
	"sort" smallint NOT NULL,
	CONSTRAINT "prep_item_versionId_position_sort_unique" UNIQUE("version_id","position","sort")
);
--> statement-breakpoint
CREATE TABLE "prep_option" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"item_id" uuid NOT NULL,
	"label" text NOT NULL,
	"is_correct" boolean NOT NULL,
	"sort" smallint NOT NULL,
	CONSTRAINT "prep_option_itemId_sort_unique" UNIQUE("item_id","sort")
);
--> statement-breakpoint
CREATE TABLE "questionnaire_version" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"label" text NOT NULL,
	"status" "questionnaire_status" DEFAULT 'draft' NOT NULL,
	"position_items_per_attempt" smallint DEFAULT 15 NOT NULL,
	"published_at" timestamp with time zone,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	CONSTRAINT "questionnaire_version_label_unique" UNIQUE("label")
);
--> statement-breakpoint
ALTER TABLE "option_weight" ADD CONSTRAINT "option_weight_option_id_position_option_id_fk" FOREIGN KEY ("option_id") REFERENCES "public"."position_option"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "position_item" ADD CONSTRAINT "position_item_version_id_questionnaire_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."questionnaire_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "position_option" ADD CONSTRAINT "position_option_item_id_position_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."position_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prep_item" ADD CONSTRAINT "prep_item_version_id_questionnaire_version_id_fk" FOREIGN KEY ("version_id") REFERENCES "public"."questionnaire_version"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "prep_option" ADD CONSTRAINT "prep_option_item_id_prep_item_id_fk" FOREIGN KEY ("item_id") REFERENCES "public"."prep_item"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE UNIQUE INDEX "prep_option_one_correct" ON "prep_option" USING btree ("item_id") WHERE "prep_option"."is_correct";