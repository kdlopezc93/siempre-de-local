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
  replies: z.object({ yes: z.int(), no: z.int(), pending: z.int() }),
  /** Tu respuesta, si eres jugador del equipo. */
  myReply: MatchReplySchema.nullable(),
  /** La alineación publicada (PR 3), o null. */
  published: z.object({ lineupId: z.uuid(), at: z.iso.datetime() }).nullable(),
});

/** Quién respondió qué: solo para el cuerpo técnico (y el admin del club). */
export const MatchRosterSchema = z.array(
  z.object({
    playerId: z.uuid(),
    displayName: z.string(),
    jerseyNumber: z.int().nullable(),
    reply: MatchReplySchema.nullable(),
  }),
);

export const MatchResponseSchema = z.object({
  match: MatchSchema,
  roster: MatchRosterSchema.nullable(),
});
export const MatchListResponseSchema = z.object({ items: z.array(MatchSchema) });

export type MatchStatus = z.infer<typeof MatchStatusSchema>;
export type MatchReply = z.infer<typeof MatchReplySchema>;
export type CreateMatchRequest = z.infer<typeof CreateMatchRequestSchema>;
export type UpdateMatchRequest = z.infer<typeof UpdateMatchRequestSchema>;
export type Match = z.infer<typeof MatchSchema>;
export type MatchRoster = z.infer<typeof MatchRosterSchema>;
export type MatchResponse = z.infer<typeof MatchResponseSchema>;
export type MatchListResponse = z.infer<typeof MatchListResponseSchema>;
