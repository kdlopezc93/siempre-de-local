import { z } from 'zod';

import { PositionCodeSchema } from './orientation.js';

export const DominantFootSchema = z.enum(['left', 'right', 'both']);

/** Perfil propio del jugador (docs/02 §1 y 03 §4). Distinto del resultado del test. */
export const ProfileSchema = z.object({
  displayName: z.string(),
  dominantFoot: DominantFootSchema.nullable(),
  /** Habilita los atributos de portero en la tarjeta (02 §7). */
  playsGoalkeeper: z.boolean(),
  /** De 1 a 3, en orden de preferencia. */
  preferredPositions: z.array(PositionCodeSchema).max(3),
});

/** PATCH /api/v1/me/profile — solo los campos que cambian. */
export const UpdateProfileRequestSchema = z
  .object({
    displayName: z.string().trim().min(2).max(40),
    dominantFoot: DominantFootSchema.nullable(),
    playsGoalkeeper: z.boolean(),
  })
  .partial();

/** PUT /api/v1/me/preferred-positions — reemplaza la lista completa, en orden. */
export const PreferredPositionsRequestSchema = z.object({
  positions: z
    .array(PositionCodeSchema)
    .max(3)
    .refine((positions) => new Set(positions).size === positions.length, 'Sin repetir'),
});

export const ProfileResponseSchema = z.object({ profile: ProfileSchema });

export type DominantFoot = z.infer<typeof DominantFootSchema>;
export type Profile = z.infer<typeof ProfileSchema>;
export type UpdateProfileRequest = z.infer<typeof UpdateProfileRequestSchema>;
export type PreferredPositionsRequest = z.infer<typeof PreferredPositionsRequestSchema>;
export type ProfileResponse = z.infer<typeof ProfileResponseSchema>;
