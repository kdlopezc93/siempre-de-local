-- Formatos en que juega cada equipo (D14). Los equipos existentes juegan su formato actual,
-- que sigue siendo el principal (`format`).
ALTER TABLE "team" ADD COLUMN "formats" "match_format"[];--> statement-breakpoint
UPDATE "team" SET "formats" = ARRAY["format"];--> statement-breakpoint
ALTER TABLE "team" ALTER COLUMN "formats" SET NOT NULL;--> statement-breakpoint
ALTER TABLE "team" ADD CONSTRAINT "team_format_in_formats" CHECK ("team"."format" = any("team"."formats"));
