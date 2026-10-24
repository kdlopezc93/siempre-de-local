import { z } from 'zod';

import { ConsentSchema } from './consent.js';
import { ProfileSchema } from './profile.js';
import { InjurySchema, MatchFormatSchema, TeamRoleSchema } from './teams.js';

export const ClubRoleSchema = z.enum(['owner', 'admin']);

/**
 * GET /api/v1/me — usuario, perfil, consentimiento y membresías activas (docs/05-api.md · Yo).
 */
export const MeResponseSchema = z.object({
  user: z.object({
    id: z.uuid(),
    name: z.string(),
    email: z.email(),
  }),
  /** Con valores por defecto si todavía no lo editó (nombre visible = el de Google). */
  profile: ProfileSchema,
  /** Aceptación de la versión vigente de la política, o null si falta. */
  consent: ConsentSchema.nullable(),
  teams: z.array(
    z.object({
      team: z.object({
        id: z.uuid(),
        name: z.string(),
        format: MatchFormatSchema,
        formats: z.array(MatchFormatSchema).min(1),
        season: z.string(),
      }),
      club: z.object({ id: z.uuid(), name: z.string() }),
      roles: z.array(TeamRoleSchema),
      /** Tu dorsal en ese equipo (lo pone el entrenador), o null. */
      jerseyNumber: z.int().nullable(),
      /** Si el cuerpo técnico te marcó como lesionado en ese equipo, o null. */
      injury: InjurySchema.nullable(),
    }),
  ),
  clubs: z.array(z.object({ id: z.uuid(), name: z.string(), role: ClubRoleSchema })),
});

export type MeResponse = z.infer<typeof MeResponseSchema>;
