CREATE TYPE "public"."lineup_mode" AS ENUM('balanced', 'performance', 'development');--> statement-breakpoint
CREATE TYPE "public"."lineup_priority" AS ENUM('none', 'defensa', 'ataque');--> statement-breakpoint
CREATE TABLE "lineup" (
	"id" uuid PRIMARY KEY DEFAULT uuidv7() NOT NULL,
	"team_id" uuid NOT NULL,
	"created_by" uuid,
	"name" text NOT NULL,
	"match_date" date,
	"format" "match_format" NOT NULL,
	"formation" text NOT NULL,
	"mode" "lineup_mode" NOT NULL,
	"weights" jsonb NOT NULL,
	"priority" "lineup_priority" DEFAULT 'none' NOT NULL,
	"min_knowledge_pct" numeric(4, 3),
	"fit_version" text NOT NULL,
	"available" uuid[] NOT NULL,
	"pins" jsonb NOT NULL,
	"assignments" jsonb NOT NULL,
	"bench" uuid[] NOT NULL,
	"created_at" timestamp with time zone DEFAULT now() NOT NULL,
	"updated_at" timestamp with time zone DEFAULT now() NOT NULL
);
--> statement-breakpoint
ALTER TABLE "lineup" ADD CONSTRAINT "lineup_team_id_team_id_fk" FOREIGN KEY ("team_id") REFERENCES "public"."team"("id") ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE "lineup" ADD CONSTRAINT "lineup_created_by_user_id_fk" FOREIGN KEY ("created_by") REFERENCES "public"."user"("id") ON DELETE set null ON UPDATE no action;--> statement-breakpoint
CREATE INDEX "lineup_team_id_updated_at_index" ON "lineup" USING btree ("team_id","updated_at" DESC NULLS LAST);