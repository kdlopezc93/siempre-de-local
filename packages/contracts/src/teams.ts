import { z } from 'zod';

export const MatchFormatSchema = z.enum(['F5', 'F8', 'F11']);
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
    /** Categoría libre ("Veteranos"…), o null (2026-10-29). */
    category: z.string().nullable().default(null),
    club: z.object({
      id: z.uuid(),
      name: z.string(),
      /** Ciudad o barrio, o null en los clubes de antes (2026-10-29). */
      city: z.string().nullable().default(null),
    }),
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
 * PATCH /api/v1/teams/:teamId/members/:userId/roles — prende o apaga sus roles de jugador y
 * de asistente (coach y admin del club). Solo lo que cambia; tiene que quedar con alguno.
 */
export const UpdateMemberRolesRequestSchema = z
  .object({ player: z.boolean(), assistant: z.boolean() })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, 'Nada que cambiar');

export type UpdateMemberRolesRequest = z.infer<typeof UpdateMemberRolesRequestSchema>;

/** PUT /api/v1/teams/:teamId/coach — pasa el mando; el entrenador anterior queda de asistente. */
export const TransferCoachRequestSchema = z.object({ userId: z.uuid() });

export type TransferCoachRequest = z.infer<typeof TransferCoachRequestSchema>;

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
