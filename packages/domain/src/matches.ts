/**
 * Partidos (Fase 7, `02` §12): el cuerpo técnico convoca, cada jugador responde voy / no voy
 * y la alineación se publica para todo el equipo. Reglas puras; el reloj lo pasa quien llama.
 */
export type MatchStatus = 'scheduled' | 'cancelled';
export type MatchReply = 'yes' | 'no';

/**
 * Abierto hasta la hora del partido (D17): se puede responder, cambiar la respuesta, editar la
 * convocatoria y (re)publicar la alineación. Cancelado o ya empezado, queda fijo.
 */
export function isMatchOpen(match: { status: MatchStatus; startsAt: Date }, now: Date): boolean {
  return match.status === 'scheduled' && now < match.startsAt;
}

/** Quién va, quién no y quién todavía no respondió, entre los jugadores activos del equipo. */
export function replySummary(
  playerIds: readonly string[],
  replies: ReadonlyMap<string, MatchReply>,
): { yes: string[]; no: string[]; pending: string[] } {
  const summary = { yes: [] as string[], no: [] as string[], pending: [] as string[] };
  for (const id of playerIds) {
    const reply = replies.get(id);
    summary[reply ?? 'pending'].push(id);
  }
  return summary;
}

/**
 * Después del partido (`02` §13, D18): el resultado y las evaluaciones se cargan una vez que
 * empezó (no cancelado) y se pueden corregir después; no hay plazo.
 */
export function hasMatchStarted(
  match: { status: MatchStatus; startsAt: Date },
  now: Date,
): boolean {
  return match.status === 'scheduled' && now >= match.startsAt;
}

/** Evaluación del partido: 1 a 5 con palabras (D18). */
export type MatchRating = 1 | 2 | 3 | 4 | 5;
export const MATCH_RATING_LABELS: Readonly<Record<MatchRating, string>> = {
  1: 'Flojo',
  2: 'Regular',
  3: 'Bien',
  4: 'Muy bien',
  5: 'Figura',
};
