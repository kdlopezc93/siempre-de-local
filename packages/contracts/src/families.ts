import { z } from 'zod';

import { ClubKindSchema } from './teams.js';

/**
 * Menores y acudientes (escuelas, 2026-11-08, `08` §10): el niño no tiene cuenta; su acudiente
 * entra con su Google, acepta la autorización del representante legal y lo inscribe.
 */

/** Versión vigente de la autorización del representante legal (docs/legal). */
export const GUARDIAN_AUTHORIZATION_VERSION = '2026-11-08';

export const GuardianRelationshipSchema = z.enum(['mother', 'father', 'guardian']);

/**
 * POST /api/v1/invitations/:code/minors — con una invitación para acudientes, inscribe a su
 * hijo como jugador del grupo. Solo nombre y año de nacimiento (minimización).
 */
export const RegisterMinorRequestSchema = z.object({
  child: z.object({
    name: z.string().trim().min(2).max(60),
    birthYear: z.int().min(1990).max(2100),
  }),
  relationship: GuardianRelationshipSchema,
  /** Tiene que ser la vigente: es la prueba de la autorización (Ley 1581). */
  authorizationVersion: z.string().min(1).max(40),
});

export const RegisterMinorResponseSchema = z.object({
  teamId: z.uuid(),
  minorId: z.uuid(),
  /** true si ese niño ya estaba en el grupo: no se gasta un uso. */
  alreadyMember: z.boolean(),
});

/** Un hijo en `/me` del acudiente, con los grupos donde está. */
export const ChildSchema = z.object({
  id: z.uuid(),
  name: z.string(),
  birthYear: z.int(),
  relationship: GuardianRelationshipSchema,
  teams: z.array(
    z.object({
      team: z.object({ id: z.uuid(), name: z.string() }),
      club: z.object({ id: z.uuid(), name: z.string(), kind: ClubKindSchema }),
    }),
  ),
});

export type GuardianRelationship = z.infer<typeof GuardianRelationshipSchema>;
export type RegisterMinorRequest = z.input<typeof RegisterMinorRequestSchema>;
export type RegisterMinorResponse = z.infer<typeof RegisterMinorResponseSchema>;
export type Child = z.infer<typeof ChildSchema>;
