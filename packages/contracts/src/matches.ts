import { z } from 'zod';

import { MatchFormatSchema } from './teams.js';

export const MatchStatusSchema = z.enum(['scheduled', 'cancelled']);
export const MatchReplySchema = z.enum(['yes', 'no']);

const Text = z.string().trim().min(1).max(80);

/** POST /teams/:teamId/matches — convocar (cuerpo técnico). `startsAt` con zona horaria. */
export const CreateMatchRequestSchema = z.object({
  format: MatchFormatSchema,
  startsAt: z.iso.datetime({ offset: true }),
  place: Text,
  opponent: Text,
});

/** PATCH /teams/:teamId/matches/:matchId — solo lo que cambia; `cancelled` lo cancela. */
export const UpdateMatchRequestSchema = CreateMatchRequestSchema.extend({
  status: z.literal('cancelled'),
})
  .partial()
  .refine((patch) => Object.keys(patch).length > 0, 'Nada que cambiar');

/** PUT /teams/:teamId/matches/:matchId/reply — el jugador: voy / no voy. */
export const MatchReplyRequestSchema = z.object({ reply: MatchReplySchema });

const PublishedPlayerSchema = z.object({
  id: z.uuid(),
  displayName: z.string(),
  jerseyNumber: z.int().nullable(),
});

/** Evaluación del partido: 1 Flojo · 2 Regular · 3 Bien · 4 Muy bien · 5 Figura (D18). */
export const MatchRatingValueSchema = z.int().min(1).max(5);

const Goals = z.int().min(0).max(99);

/** El resultado: lo ve todo el equipo, con la figura del partido si la eligieron. */
export const MatchResultSchema = z.object({
  goalsFor: Goals,
  goalsAgainst: Goals,
  figure: PublishedPlayerSchema.nullable(),
  at: z.iso.datetime(),
});

export const MatchSchema = z.object({
  id: z.uuid(),
  format: MatchFormatSchema,
  startsAt: z.iso.datetime(),
  place: z.string(),
  opponent: z.string(),
  status: MatchStatusSchema,
  /** Se puede responder, editar y (re)publicar: programado y antes de la hora (D17). */
  open: z.boolean(),
  createdBy: z.object({ id: z.uuid(), name: z.string() }).nullable(),
  /** Cuántos van, no van y faltan, entre los jugadores activos. */
  /** `injured`: lesionados que no respondieron (no cuentan como pendientes). */
  replies: z.object({ yes: z.int(), no: z.int(), pending: z.int(), injured: z.int() }),
  /** Tu respuesta, si eres jugador del equipo. */
  myReply: MatchReplySchema.nullable(),
  /** La alineación publicada (PR 3), o null. */
  published: z.object({ lineupId: z.uuid(), at: z.iso.datetime() }).nullable(),
  /** Después del partido (D18): el resultado, o null si todavía no lo cargaron. */
  result: MatchResultSchema.nullable(),
  /**
   * Tu evaluación del partido, si eres jugador y el equipo las muestra (D18). Sin nota ni autor:
   * eso es del cuerpo técnico.
   */
  myRating: MatchRatingValueSchema.nullable(),
});

/** Quién respondió qué: solo para el cuerpo técnico (y el admin del club). */
export const MatchRosterSchema = z.array(
  z.object({
    playerId: z.uuid(),
    displayName: z.string(),
    jerseyNumber: z.int().nullable(),
    reply: MatchReplySchema.nullable(),
    /** Si quien pregunta puede evaluarlo después del partido (04 §2.2). */
    canRate: z.boolean(),
    /** Lesionado: no cuenta como pendiente de responder. */
    injured: z.boolean(),
  }),
);

export const MatchResponseSchema = z.object({
  match: MatchSchema,
  roster: MatchRosterSchema.nullable(),
});
export const MatchListResponseSchema = z.object({ items: z.array(MatchSchema) });

/**
 * PUT /teams/:teamId/matches/:matchId/result — el cuerpo técnico, desde la hora del partido.
 * Se puede corregir después. La figura, si la eligen, es un jugador del equipo.
 */
export const MatchResultRequestSchema = z.object({
  goalsFor: Goals,
  goalsAgainst: Goals,
  figurePlayerId: z.uuid().nullable(),
});

const Note = z
  .string()
  .trim()
  .max(280)
  .transform((note) => note || null);

/** PUT /teams/:teamId/matches/:matchId/ratings/:playerId — evaluar a un jugador (staff). */
export const MatchRatingRequestSchema = z.object({
  rating: MatchRatingValueSchema,
  note: Note.nullable().optional(),
});

/** GET /teams/:teamId/matches/:matchId/ratings — las del partido, con notas (cuerpo técnico). */
export const MatchRatingsResponseSchema = z.object({
  items: z.array(
    z.object({
      playerId: z.uuid(),
      displayName: z.string(),
      jerseyNumber: z.int().nullable(),
      rating: MatchRatingValueSchema,
      note: z.string().nullable(),
      ratedBy: z.object({ id: z.uuid(), name: z.string() }).nullable(),
      ratedAt: z.iso.datetime(),
    }),
  ),
});

/**
 * GET /teams/:teamId/players/:playerId/match-ratings — cómo le fue partido a partido, del más
 * reciente al más antiguo (cuerpo técnico y admin del club).
 */
export const PlayerMatchRatingsResponseSchema = z.object({
  items: z.array(
    z.object({
      matchId: z.uuid(),
      opponent: z.string(),
      startsAt: z.iso.datetime(),
      rating: MatchRatingValueSchema,
      note: z.string().nullable(),
    }),
  ),
});

export type MatchStatus = z.infer<typeof MatchStatusSchema>;
export type MatchReply = z.infer<typeof MatchReplySchema>;
export type CreateMatchRequest = z.infer<typeof CreateMatchRequestSchema>;
export type UpdateMatchRequest = z.infer<typeof UpdateMatchRequestSchema>;
export type Match = z.infer<typeof MatchSchema>;
export type MatchRoster = z.infer<typeof MatchRosterSchema>;
export type MatchResponse = z.infer<typeof MatchResponseSchema>;
export type MatchListResponse = z.infer<typeof MatchListResponseSchema>;
export type MatchRatingValue = z.infer<typeof MatchRatingValueSchema>;
export type MatchResult = z.infer<typeof MatchResultSchema>;
export type MatchResultRequest = z.infer<typeof MatchResultRequestSchema>;
export type MatchRatingRequest = z.input<typeof MatchRatingRequestSchema>;
export type MatchRatingsResponse = z.infer<typeof MatchRatingsResponseSchema>;
export type PlayerMatchRatingsResponse = z.infer<typeof PlayerMatchRatingsResponseSchema>;

/**
 * GET /teams/:teamId/matches/:matchId/lineup — la alineación publicada, para todo el equipo
 * (D17): formación, titulares por puesto y suplentes. Nada del encaje ni del desglose.
 */
export const PublishedLineupResponseSchema = z.object({
  matchId: z.uuid(),
  format: MatchFormatSchema,
  formation: z.string(),
  publishedAt: z.iso.datetime(),
  starters: z.array(z.object({ slotId: z.string(), player: PublishedPlayerSchema.nullable() })),
  bench: z.array(PublishedPlayerSchema),
});
export type PublishedLineupResponse = z.infer<typeof PublishedLineupResponseSchema>;
