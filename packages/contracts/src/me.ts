import { z } from 'zod';

import { ConsentSchema } from './consent.js';
import { MatchFormatSchema, TeamRoleSchema } from './teams.js';

export const ClubRoleSchema = z.enum(['owner', 'admin']);

/**
 * GET /api/v1/me — usuario, consentimiento y membresías activas (docs/05-api.md · Yo).
 * El perfil del jugador se añade con su PR.
 */
export const MeResponseSchema = z.object({
  user: z.object({
    id: z.uuid(),
    name: z.string(),
    email: z.email(),
  }),
  /** Aceptación de la versión vigente de la política, o null si falta. */
  consent: ConsentSchema.nullable(),
  teams: z.array(
    z.object({
      team: z.object({
        id: z.uuid(),
        name: z.string(),
        format: MatchFormatSchema,
        season: z.string(),
      }),
      club: z.object({ id: z.uuid(), name: z.string() }),
      roles: z.array(TeamRoleSchema),
    }),
  ),
  clubs: z.array(z.object({ id: z.uuid(), name: z.string(), role: ClubRoleSchema })),
});

export type MeResponse = z.infer<typeof MeResponseSchema>;
