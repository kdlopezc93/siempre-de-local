import { z } from 'zod';

import { MatchFormatSchema } from './teams.js';

/**
 * Códigos de alta (2026-10-29): para crear un club desde la app hace falta uno, y los genera el
 * administrador de la plataforma. Cada código sirve para un club y vence.
 */

/** POST /api/v1/admin/club-codes */
export const CreateClubCodeRequestSchema = z.object({
  /** Para quién es, para reconocerlo en la lista ("Pedro, Los Tigres"). */
  note: z.string().trim().max(80).optional(),
  expiresInDays: z.int().min(1).max(60).default(14),
});

export const ClubCodeStatusSchema = z.enum(['active', 'expired', 'used', 'revoked']);

/** Un código sin el código: se ve una sola vez, al crearlo. */
export const ClubCodeSummarySchema = z.object({
  id: z.uuid(),
  note: z.string().nullable(),
  status: ClubCodeStatusSchema,
  expiresAt: z.iso.datetime(),
  createdAt: z.iso.datetime(),
  /** El club que se creó con él, si ya se usó. */
  club: z.object({ id: z.uuid(), name: z.string() }).nullable(),
});

export const CreateClubCodeResponseSchema = z.object({
  clubCode: ClubCodeSummarySchema,
  code: z.string(),
  /** Enlace listo para compartir: `<app>/crear-club/<código>`. */
  url: z.url(),
});

/** GET /api/v1/admin/club-codes — del más reciente al más antiguo. */
export const ClubCodeListResponseSchema = z.object({ items: z.array(ClubCodeSummarySchema) });

export type CreateClubCodeRequest = z.input<typeof CreateClubCodeRequestSchema>;
export type ClubCodeStatus = z.infer<typeof ClubCodeStatusSchema>;
export type ClubCodeSummary = z.infer<typeof ClubCodeSummarySchema>;
export type CreateClubCodeResponse = z.infer<typeof CreateClubCodeResponseSchema>;
export type ClubCodeListResponse = z.infer<typeof ClubCodeListResponseSchema>;

/** GET /api/v1/club-codes/:code — público: si el código sirve, antes de llenar el formulario. */
export const ClubCodePreviewResponseSchema = z.object({ expiresAt: z.iso.datetime() });

const Name = z.string().trim().min(2).max(60);

/**
 * POST /api/v1/clubs — crear mi club con un código de alta (2026-10-29): el club con su ciudad o
 * barrio, y su primer equipo. Quien lo crea queda de dueño del club y entrenador del equipo (y
 * jugador, con `alsoPlays`). Es dueño de un solo club.
 */
export const CreateClubRequestSchema = z.object({
  code: z.string().trim().min(1).max(40),
  clubName: Name,
  city: Name,
  teamName: Name,
  category: z.string().trim().max(40).optional(),
  format: MatchFormatSchema,
  season: z.string().trim().min(4).max(9),
  alsoPlays: z.boolean().default(false),
});

export const CreateClubResponseSchema = z.object({ clubId: z.uuid(), teamId: z.uuid() });

export type ClubCodePreviewResponse = z.infer<typeof ClubCodePreviewResponseSchema>;
export type CreateClubRequest = z.input<typeof CreateClubRequestSchema>;
export type CreateClubResponse = z.infer<typeof CreateClubResponseSchema>;

/**
 * POST /api/v1/clubs/:clubId/teams — otro equipo del club (dueño o admin, 2026-10-29). Quien lo
 * crea queda de entrenador (y jugador, con `alsoPlays`); si lo va a entrenar otra persona, la
 * invita como entrenador y al aceptar se pasa el mando. Hasta 3 equipos activos por club.
 */
export const CreateTeamRequestSchema = z.object({
  name: Name,
  category: z.string().trim().max(40).optional(),
  format: MatchFormatSchema,
  season: z.string().trim().min(4).max(9),
  alsoPlays: z.boolean().default(false),
});

export const CreateTeamResponseSchema = z.object({ teamId: z.uuid() });

export type CreateTeamRequest = z.input<typeof CreateTeamRequestSchema>;
export type CreateTeamResponse = z.infer<typeof CreateTeamResponseSchema>;

/**
 * GET /api/v1/clubs/:clubId — la pantalla del club (dueño y admins, 2026-10-29): sus datos y sus
 * equipos, activos y archivados.
 */
export const ClubResponseSchema = z.object({
  club: z.object({ id: z.uuid(), name: z.string(), city: z.string().nullable() }),
  myRole: z.enum(['owner', 'admin']),
  teams: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      category: z.string().nullable(),
      format: MatchFormatSchema,
      season: z.string(),
      archived: z.boolean(),
      /** Personas activas en el equipo (cada una una vez, aunque tenga varios roles). */
      members: z.int(),
    }),
  ),
});

/** PATCH /api/v1/clubs/:clubId — nombre y ciudad o barrio; solo lo que cambia. */
export const UpdateClubRequestSchema = z
  .object({ name: Name, city: Name })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, 'Nada que cambiar');

export type ClubResponse = z.infer<typeof ClubResponseSchema>;
export type UpdateClubRequest = z.infer<typeof UpdateClubRequestSchema>;
