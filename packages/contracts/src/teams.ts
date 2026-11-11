import { z } from 'zod';

export const MatchFormatSchema = z.enum(['F5', 'F8', 'F11']);
/** `treasurer` (2026-10-30): maneja los cobros y pasa lista; puede ser también jugador. */
export const TeamRoleSchema = z.enum(['coach', 'assistant', 'player', 'treasurer']);
/** Con invitación se entra de jugador, asistente o entrenador; tesorero se nombra en Roles. */
export const InvitationRoleSchema = TeamRoleSchema.exclude(['treasurer']);

/** Un color `#rrggbb` (2026-11-06): los colores del equipo. */
export const HexColorSchema = z
  .string()
  .trim()
  .toLowerCase()
  .regex(/^#[0-9a-f]{6}$/, 'Color inválido');
/** Principal (el fondo de los afiches), secundario (las cifras) y tercero opcional (la franja). */
export const TeamColorsSchema = z.array(HexColorSchema).min(2).max(3);

/** Escuelas (2026-11-07): un club de barrio o una escuela deportiva. */
export const ClubKindSchema = z.enum(['club', 'school']);
/** El deporte es un dato del club (08 §8, decisión 3); fútbol primero. */
export const SportSchema = z.enum(['football']);
/** Categoría masculina, femenina o mixta (escuelas, 2026-11-07). */
export const CategoryGenderSchema = z.enum(['male', 'female', 'mixed']);

/**
 * La categoría de una escuela por años de nacimiento (2026-11-07): `{ from: 2014, to: 2015 }`.
 * Un solo año, `from` igual a `to`; `from: null`, abierta por abajo: "2008 o antes" (18+).
 */
export const BirthYearsSchema = z
  .object({
    from: z.int().min(1900).max(2100).nullable(),
    to: z.int().min(1900).max(2100),
  })
  .refine(
    (years) => years.from === null || years.from <= years.to,
    'El primer año va antes del último',
  );

export type MatchFormat = z.infer<typeof MatchFormatSchema>;
export type ClubKind = z.infer<typeof ClubKindSchema>;
export type Sport = z.infer<typeof SportSchema>;
export type CategoryGender = z.infer<typeof CategoryGenderSchema>;
export type BirthYears = z.infer<typeof BirthYearsSchema>;
export type TeamRole = z.infer<typeof TeamRoleSchema>;
export type InvitationRole = z.infer<typeof InvitationRoleSchema>;

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
    /** En una escuela, los años de nacimiento de la categoría, o null (2026-11-07). */
    birthYears: BirthYearsSchema.nullable().default(null),
    /** En una escuela, masculina, femenina o mixta, o null (2026-11-07). */
    gender: CategoryGenderSchema.nullable().default(null),
    /** La sede donde entrena (escuelas, 2026-11-07), o null. */
    venue: z.object({ id: z.uuid(), name: z.string() }).nullable().default(null),
    club: z.object({
      id: z.uuid(),
      name: z.string(),
      /** Ciudad o barrio, o null en los clubes de antes (2026-10-29). */
      city: z.string().nullable().default(null),
      /** Club o escuela (2026-11-07): en una escuela, el equipo se llama categoría. */
      kind: ClubKindSchema.default('club'),
      sport: SportSchema.default('football'),
    }),
    /** ¿El jugador ve su tarjeta 0–99? (D8) */
    ratingsVisibleToPlayers: z.boolean(),
    /** ¿El jugador ve su evaluación de cada partido? (D18) */
    matchRatingsVisibleToPlayers: z.boolean(),
    /** Los colores del equipo para los afiches, o null: los de la app (2026-11-06). */
    colors: TeamColorsSchema.nullable().default(null),
    /** ¿La app recuerda la convocatoria a los que no han respondido? (2026-11-06) */
    callUpReminders: z.boolean().default(true),
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
 * PATCH /api/v1/teams/:teamId/members/:userId/roles — prende o apaga sus roles de jugador, de
 * asistente y de tesorero (coach y admin del club). Solo lo que cambia; tiene que quedar con alguno.
 */
export const UpdateMemberRolesRequestSchema = z
  .object({ player: z.boolean(), assistant: z.boolean(), treasurer: z.boolean() })
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, 'Nada que cambiar');

export type UpdateMemberRolesRequest = z.infer<typeof UpdateMemberRolesRequestSchema>;

/**
 * POST /api/v1/teams/:teamId/members/:userId/move — pasa a un jugador a otro grupo de la misma
 * escuela (2026-11-10): sale de este con su historial y entra al otro de jugador.
 */
export const MovePlayerRequestSchema = z.object({ toTeamId: z.uuid() });

export type MovePlayerRequest = z.infer<typeof MovePlayerRequestSchema>;

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
