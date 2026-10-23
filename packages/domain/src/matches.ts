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
