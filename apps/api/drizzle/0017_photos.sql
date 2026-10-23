-- Fotos opcionales del jugador y del equipo (ADR-09): solo la clave; el archivo va al almacenamiento de fotos.
ALTER TABLE "team" ADD COLUMN "photo_key" text;--> statement-breakpoint
ALTER TABLE "player_profile" ADD COLUMN "photo_key" text;