import { z } from 'zod';

import { PositionCodeSchema } from './orientation.js';
import { MatchFormatSchema } from './teams.js';

const OUTFIELD = ['PAC', 'SHO', 'PAS', 'DRI', 'DEF', 'PHY'] as const;
const GOALKEEPER = ['GK_DIV', 'GK_HAN', 'GK_KIC', 'GK_REF', 'GK_SPD', 'GK_POS'] as const;

export const RatingAttributeCodeSchema = z.enum([...OUTFIELD, ...GOALKEEPER]);
const Value = z.int().min(0).max(99);

/**
 * Valores de una foto de la tarjeta: los 6 de campo siempre; los 6 de portero, todos o
 * ninguno (02 §7). Enteros 0–99.
 */
export const RatingValuesSchema = z
  .object({
    ...Object.fromEntries(OUTFIELD.map((code) => [code, Value])),
    ...Object.fromEntries(GOALKEEPER.map((code) => [code, Value.optional()])),
  } as Record<(typeof OUTFIELD)[number], typeof Value> &
    Record<(typeof GOALKEEPER)[number], z.ZodOptional<typeof Value>>)
  .strict()
  .refine((values) => {
    const gk = GOALKEEPER.filter((code) => values[code] !== undefined).length;
    return gk === 0 || gk === GOALKEEPER.length;
  }, 'Los atributos de portero van todos o ninguno');

/** POST /api/v1/teams/:teamId/players/:userId/ratings — una foto nueva (coach, assistant). */
export const CreateRatingRequestSchema = z.object({
  values: RatingValuesSchema,
  notes: z.string().trim().max(500).optional(),
  /**
   * La posición de la tarjeta (02 §7.4): la elige quien puntúa, aparte de los valores. Portero,
   * solo con sus atributos. Sin ella, la tarjeta encabeza con su mejor media.
   */
  position: PositionCodeSchema.optional(),
});

/** Media por posición (MP) calculada con la fórmula vigente; sin portero si no hay sus atributos. */
const PositionAveragesSchema = z.partialRecord(PositionCodeSchema, z.int());

export const PlayerRatingSchema = z.object({
  id: z.uuid(),
  playerId: z.uuid(),
  /** Quién puntuó (null si se borró su cuenta). */
  ratedBy: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  ratedAt: z.iso.datetime(),
  source: z.enum(['manual', 'field_test']),
  notes: z.string().nullable(),
  /** La posición que le puso quien puntuó; null en las fotos de antes (02 §7.4). */
  position: PositionCodeSchema.nullable(),
  values: z.partialRecord(RatingAttributeCodeSchema, z.int()),
  positionAverages: PositionAveragesSchema,
  formulaVersion: z.string(),
});

export const RatingResponseSchema = z.object({ rating: PlayerRatingSchema });
/** GET …/ratings — de la más reciente a la más antigua. */
export const RatingHistoryResponseSchema = z.object({ items: z.array(PlayerRatingSchema) });

/**
 * GET /api/v1/me/card?teamId= — la tarjeta del propio jugador, si el equipo la hace
 * visible (D8). Sin notas ni autor: eso es del cuerpo técnico.
 */
export const MyCardResponseSchema = z.object({
  card: PlayerRatingSchema.pick({
    ratedAt: true,
    position: true,
    values: true,
    positionAverages: true,
    formulaVersion: true,
  }).nullable(),
});

/** GET /api/v1/rating-attributes — catálogo y anclas de la escala. */
export const RatingAttributesResponseSchema = z.object({
  attributes: z.array(
    z.object({
      code: RatingAttributeCodeSchema,
      name: z.string(),
      short: z.string(),
      group: z.enum(['outfield', 'goalkeeper']),
    }),
  ),
  anchors: z.array(z.object({ min: z.int(), max: z.int(), label: z.string() })),
  formulaVersion: z.string(),
});

/**
 * PATCH /api/v1/teams/:teamId — los datos y ajustes del equipo (coach y admin del club). Solo
 * lo que cambia. `format` es el principal (D14) y tiene que estar entre `formats`.
 */
export const UpdateTeamRequestSchema = z
  .object({
    ratingsVisibleToPlayers: z.boolean(),
    matchRatingsVisibleToPlayers: z.boolean(),
    name: z.string().trim().min(2).max(60),
    /** Categoría libre; vacía la quita (2026-10-29). */
    category: z
      .string()
      .trim()
      .max(40)
      .transform((value) => value || null)
      .nullable(),
    format: MatchFormatSchema,
    formats: z
      .array(MatchFormatSchema)
      .min(1)
      .refine((f) => new Set(f).size === f.length, 'Formatos repetidos'),
  })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, 'Nada que cambiar');

export type RatingAttributeCode = z.infer<typeof RatingAttributeCodeSchema>;
export type RatingValues = z.infer<typeof RatingValuesSchema>;
export type CreateRatingRequest = z.input<typeof CreateRatingRequestSchema>;
export type PlayerRating = z.infer<typeof PlayerRatingSchema>;
export type RatingResponse = z.infer<typeof RatingResponseSchema>;
export type RatingHistoryResponse = z.infer<typeof RatingHistoryResponseSchema>;
export type MyCardResponse = z.infer<typeof MyCardResponseSchema>;
export type RatingAttributesResponse = z.infer<typeof RatingAttributesResponseSchema>;
export type UpdateTeamRequest = z.input<typeof UpdateTeamRequestSchema>;
