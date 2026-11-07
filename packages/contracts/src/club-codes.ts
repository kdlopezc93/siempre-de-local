import { z } from 'zod';

import {
  BirthYearsSchema,
  CategoryGenderSchema,
  ClubKindSchema,
  MatchFormatSchema,
  SportSchema,
} from './teams.js';

/**
 * Códigos de alta (2026-10-29): para crear un club desde la app hace falta uno, y los genera el
 * administrador de la plataforma. Cada código sirve para un club y vence.
 */

/** POST /api/v1/admin/club-codes */
export const CreateClubCodeRequestSchema = z.object({
  /** Para quién es, para reconocerlo en la lista ("Pedro, Los Tigres"). */
  note: z.string().trim().max(80).optional(),
  /** Si abre un club de barrio o una escuela (2026-11-07). */
  kind: ClubKindSchema.default('club'),
  expiresInDays: z.int().min(1).max(60).default(14),
});

export const ClubCodeStatusSchema = z.enum(['active', 'expired', 'used', 'revoked']);

/** Un código sin el código: se ve una sola vez, al crearlo. */
export const ClubCodeSummarySchema = z.object({
  id: z.uuid(),
  note: z.string().nullable(),
  kind: ClubKindSchema,
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
export const ClubCodePreviewResponseSchema = z.object({
  expiresAt: z.iso.datetime(),
  /** Qué abre: el formulario de un club o el de una escuela (2026-11-07). */
  kind: ClubKindSchema,
});

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
  /** En una escuela, obligatorio: los años de nacimiento de su primera categoría (2026-11-07). */
  birthYears: BirthYearsSchema.optional(),
  /** En una escuela, obligatorio: masculina, femenina o mixta. */
  gender: CategoryGenderSchema.optional(),
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
  /** En una escuela, obligatorio: los años de nacimiento de la categoría (2026-11-07). */
  birthYears: BirthYearsSchema.optional(),
  /** En una escuela, obligatorio: masculina, femenina o mixta (2026-11-07). */
  gender: CategoryGenderSchema.optional(),
  /** En una escuela, opcional: la sede donde entrena (2026-11-07). */
  venueId: z.uuid().optional(),
});

export const CreateTeamResponseSchema = z.object({ teamId: z.uuid() });

export type CreateTeamRequest = z.input<typeof CreateTeamRequestSchema>;
export type CreateTeamResponse = z.infer<typeof CreateTeamResponseSchema>;

/**
 * GET /api/v1/clubs/:clubId — la pantalla del club (dueño y admins, 2026-10-29): sus datos y sus
 * equipos, activos y archivados.
 */
export const ClubResponseSchema = z.object({
  club: z.object({
    id: z.uuid(),
    name: z.string(),
    city: z.string().nullable(),
    /** Club o escuela (2026-11-07): en una escuela, los equipos son categorías. */
    kind: ClubKindSchema,
    sport: SportSchema,
  }),
  myRole: z.enum(['owner', 'admin']),
  /** Cuántos equipos activos puede tener: 3 en un club, 12 categorías en una escuela. */
  teamsLimit: z.int(),
  teams: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      category: z.string().nullable(),
      format: MatchFormatSchema,
      season: z.string(),
      archived: z.boolean(),
      /** En una escuela, los años de nacimiento de la categoría, o null (2026-11-07). */
      birthYears: BirthYearsSchema.nullable(),
      gender: CategoryGenderSchema.nullable(),
      /** La sede donde entrena, o null (2026-11-07). */
      venue: z.object({ id: z.uuid(), name: z.string() }).nullable(),
      /** Personas activas en el equipo (cada una una vez, aunque tenga varios roles). */
      members: z.int(),
    }),
  ),
  /** El dueño y los admins del club (2026-10-29). */
  admins: z.array(
    z.object({ userId: z.uuid(), name: z.string(), role: z.enum(['owner', 'admin']) }),
  ),
  /** Quiénes se pueden nombrar admin: integrantes de sus equipos activos que aún no lo son. */
  candidates: z.array(z.object({ userId: z.uuid(), name: z.string() })),
  /** Las sedes de la escuela, por nombre (2026-11-07); vacío en un club. */
  venues: z.array(
    z.object({
      id: z.uuid(),
      name: z.string(),
      address: z.string().nullable(),
      /** Categorías activas que entrenan ahí. */
      teams: z.int(),
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

/**
 * PATCH /api/v1/clubs/:clubId/teams/:teamId — archivar o desarchivar un equipo (dueño o admin,
 * 2026-10-29). Archivado, deja de verse y de dar acceso; sus datos quedan.
 */
export const UpdateClubTeamRequestSchema = z.object({ archived: z.boolean() });

export type UpdateClubTeamRequest = z.infer<typeof UpdateClubTeamRequestSchema>;

/** POST /api/v1/clubs/:clubId/admins — el dueño nombra admin a un integrante (2026-10-29). */
export const AddClubAdminRequestSchema = z.object({ userId: z.uuid() });

export type AddClubAdminRequest = z.infer<typeof AddClubAdminRequestSchema>;

/**
 * POST /api/v1/clubs/:clubId/venues — una sede de la escuela (dueño o admin, 2026-11-07).
 * PATCH /api/v1/clubs/:clubId/venues/:venueId — solo lo que cambia. Las dos devuelven el club.
 */
export const CreateVenueRequestSchema = z.object({
  name: Name,
  address: z
    .string()
    .trim()
    .max(120)
    .transform((value) => value || null)
    .nullable()
    .optional(),
});

export const UpdateVenueRequestSchema = CreateVenueRequestSchema.partial().refine(
  (patch) => Object.keys(patch).length > 0,
  'Nada que cambiar',
);

export type CreateVenueRequest = z.input<typeof CreateVenueRequestSchema>;
export type UpdateVenueRequest = z.input<typeof UpdateVenueRequestSchema>;
