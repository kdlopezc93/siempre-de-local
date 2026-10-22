import { z } from 'zod';

import { PositionCodeSchema } from './orientation.js';
import { MatchFormatSchema } from './teams.js';

/**
 * POST /api/v1/teams/:teamId/legacy-import — CSV del prototipo como texto (02 §12): el
 * celular lee el archivo o el entrenador lo pega. Varios CSV seguidos valen.
 */
export const LegacyImportRequestSchema = z.object({
  csv: z.string().min(1).max(512_000),
});

export const LegacyImportResponseSchema = z.object({
  /** Filas nuevas guardadas. */
  imported: z.int(),
  /** Filas que ya estaban (mismo nombre, fecha y posición). */
  duplicates: z.int(),
  /** De las nuevas, cuántas quedaron ligadas a un jugador del equipo por su nombre. */
  linked: z.int(),
  /** Filas que no se pudieron leer, con su línea. */
  rejected: z.array(z.object({ line: z.int(), reason: z.string() })),
});

export const LegacyResultSchema = z.object({
  id: z.uuid(),
  playerName: z.string(),
  /** El jugador del equipo con ese nombre, si hay uno solo. */
  player: z.object({ userId: z.uuid(), displayName: z.string() }).nullable(),
  /** Hora local del celular, `YYYY-MM-DDTHH:mm`, o null si el CSV no la traía. */
  takenAt: z.string().nullable(),
  format: MatchFormatSchema.nullable(),
  winner: PositionCodeSchema,
  affinityPct: z.int().nullable(),
  podium: z.array(PositionCodeSchema),
  prepScore: z.int().nullable(),
  prepTotal: z.int().nullable(),
  importedAt: z.iso.datetime(),
});

/** GET /api/v1/teams/:teamId/legacy-results */
export const LegacyResultListResponseSchema = z.object({ items: z.array(LegacyResultSchema) });

export type LegacyImportRequest = z.infer<typeof LegacyImportRequestSchema>;
export type LegacyImportResponse = z.infer<typeof LegacyImportResponseSchema>;
export type LegacyResult = z.infer<typeof LegacyResultSchema>;
export type LegacyResultListResponse = z.infer<typeof LegacyResultListResponseSchema>;
