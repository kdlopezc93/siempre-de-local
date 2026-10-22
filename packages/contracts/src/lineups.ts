import { z } from 'zod';

import { PositionCodeSchema } from './orientation.js';
import { MatchFormatSchema } from './teams.js';

/** Señales de un jugador para el planificador (02 §9.1), tal como las espera el dominio. */
const SignalsSchema = z.object({
  /** Afinidad 0–1 del test por posición. Ausente si no lo hizo o si quien pregunta aún no lo valoró. */
  affinity: z.partialRecord(PositionCodeSchema, z.number()).optional(),
  assessment: z
    .object({ primary: PositionCodeSchema, secondary: z.array(PositionCodeSchema) })
    .optional(),
  knowledge: z
    .partialRecord(PositionCodeSchema, z.object({ pct: z.number(), reviewExpired: z.boolean() }))
    .optional(),
  /** Media por posición de la tarjeta (0–99). */
  rating: z.partialRecord(PositionCodeSchema, z.int()).optional(),
});

/** GET /api/v1/teams/:teamId/lineup-inputs — lo que necesita el celular para armar. */
export const LineupInputsResponseSchema = z.object({
  format: MatchFormatSchema,
  players: z.array(
    SignalsSchema.extend({
      playerId: z.uuid(),
      displayName: z.string(),
      jerseyNumber: z.int().nullable(),
      preferredPositions: z.array(PositionCodeSchema),
    }),
  ),
});

const SignalKeySchema = z.enum(['A', 'V', 'C', 'R']);
const BreakdownSchema = z.partialRecord(SignalKeySchema, z.number());

/** Una alineación guardada: la foto completa del cálculo y de lo que tocó el entrenador. */
export const LineupInputSchema = z.object({
  name: z.string().trim().min(1).max(80),
  matchDate: z.iso.date().nullable(),
  formation: z.string(),
  mode: z.enum(['balanced', 'performance', 'development']),
  weights: z.record(SignalKeySchema, z.number().min(0).max(1)),
  priority: z.enum(['none', 'defensa', 'ataque']),
  minKnowledgePct: z.number().min(0).max(1).nullable(),
  fitVersion: z.string(),
  /** Los convocados. */
  available: z.array(z.uuid()),
  pins: z.array(z.object({ slotId: z.string(), playerId: z.uuid() })),
  assignments: z.array(
    z.object({
      slotId: z.string(),
      playerId: z.uuid().nullable(),
      fit: z.number().nullable(),
      breakdown: BreakdownSchema.nullable(),
      pinned: z.boolean(),
      /** Lo ubicó o intercambió el entrenador a mano. */
      manual: z.boolean(),
    }),
  ),
  bench: z.array(z.uuid()),
});

export const LineupSchema = LineupInputSchema.extend({
  id: z.uuid(),
  format: MatchFormatSchema,
  createdBy: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});

export const LineupResponseSchema = z.object({ lineup: LineupSchema });

/** GET /api/v1/teams/:teamId/lineups — de la más reciente a la más antigua. */
export const LineupListResponseSchema = z.object({
  items: z.array(
    LineupSchema.pick({
      id: true,
      name: true,
      matchDate: true,
      formation: true,
      createdBy: true,
      updatedAt: true,
    }),
  ),
});

export type LineupInputsResponse = z.infer<typeof LineupInputsResponseSchema>;
export type LineupInput = z.input<typeof LineupInputSchema>;
export type Lineup = z.infer<typeof LineupSchema>;
export type LineupResponse = z.infer<typeof LineupResponseSchema>;
export type LineupListResponse = z.infer<typeof LineupListResponseSchema>;
