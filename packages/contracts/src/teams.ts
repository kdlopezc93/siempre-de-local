import { z } from 'zod';

export const MatchFormatSchema = z.enum(['F8', 'F11']);
export const TeamRoleSchema = z.enum(['coach', 'assistant', 'player']);

export type MatchFormat = z.infer<typeof MatchFormatSchema>;
export type TeamRole = z.infer<typeof TeamRoleSchema>;

/** GET /api/v1/teams/:teamId — miembros del equipo y admins de su club. */
export const TeamResponseSchema = z.object({
  team: z.object({
    id: z.uuid(),
    name: z.string(),
    /** El formato principal (D14): el del test, la valoración y la tarjeta. */
    format: MatchFormatSchema,
    /** Los formatos en que juega; el planificador elige entre estos por partido. */
    formats: z.array(MatchFormatSchema).min(1),
    season: z.string(),
    club: z.object({ id: z.uuid(), name: z.string() }),
    /** ¿El jugador ve su tarjeta 0–99? (D8) */
    ratingsVisibleToPlayers: z.boolean(),
    /** ¿El jugador ve su evaluación de cada partido? (D18) */
    matchRatingsVisibleToPlayers: z.boolean(),
  }),
  /** Roles activos de quien pregunta en este equipo (vacío si entra como admin del club). */
  myRoles: z.array(TeamRoleSchema),
});

export type TeamResponse = z.infer<typeof TeamResponseSchema>;

/**
 * PATCH /api/v1/teams/:teamId/members/:userId — el dorsal de un jugador lo pone el
 * cuerpo técnico. Se puede repetir (dos jugadores pueden tener la misma camiseta).
 */
export const UpdateMemberRequestSchema = z.object({
  jerseyNumber: z.int().min(0).max(99).nullable(),
});

export type UpdateMemberRequest = z.infer<typeof UpdateMemberRequestSchema>;

/**
 * Lesionado (2026-10-24): lo marca el cuerpo técnico, con una vuelta estimada opcional. No se
 * guarda qué tiene. `since` lo pone el servidor.
 */
export const InjurySchema = z.object({
  since: z.iso.datetime(),
  returnOn: z.iso.date().nullable(),
});

/** PUT /api/v1/teams/:teamId/players/:userId/injury (DELETE: volvió). */
export const SetInjuryRequestSchema = z.object({
  returnOn: z.iso.date().nullable(),
});

export type Injury = z.infer<typeof InjurySchema>;
export type SetInjuryRequest = z.infer<typeof SetInjuryRequestSchema>;
