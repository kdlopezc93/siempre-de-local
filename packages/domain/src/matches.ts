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

/**
 * El cuerpo técnico corrige (fecha, hora, lugar, rival, formato) o cancela el partido mientras
 * esté programado y no tenga resultado, aunque ya haya pasado la hora (2026-10-25: se guardó a
 * la 1:30 a. m. en vez de p. m. y no había cómo arreglarlo). Con resultado, queda en la historia.
 */
export function isMatchEditable(match: { status: MatchStatus; hasResult: boolean }): boolean {
  return match.status === 'scheduled' && !match.hasResult;
}

/**
 * Quién va, quién no, quién todavía no respondió y los lesionados que no respondieron, entre
 * los jugadores activos del equipo.
 */
export function replySummary(
  playerIds: readonly string[],
  replies: ReadonlyMap<string, MatchReply>,
  injured: ReadonlySet<string> = new Set(),
): { yes: string[]; no: string[]; pending: string[]; injured: string[] } {
  const summary = {
    yes: [] as string[],
    no: [] as string[],
    pending: [] as string[],
    injured: [] as string[],
  };
  for (const id of playerIds) {
    const reply = replies.get(id);
    // Un lesionado que no respondió no queda pendiente: se cuenta aparte (2026-10-24).
    summary[reply ?? (injured.has(id) ? 'injured' : 'pending')].push(id);
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

/**
 * El balance del equipo (2026-10-25): los jugados son los que tienen resultado, y los
 * cancelados se cuentan aparte para saber cuántos se nos han caído.
 */
export function matchTally(
  matches: readonly {
    status: MatchStatus;
    result: { goalsFor: number; goalsAgainst: number } | null;
  }[],
): { played: number; won: number; drawn: number; lost: number; cancelled: number } {
  const tally = { played: 0, won: 0, drawn: 0, lost: 0, cancelled: 0 };
  for (const m of matches) {
    if (m.status === 'cancelled') tally.cancelled++;
    else if (m.result) {
      tally.played++;
      const diff = m.result.goalsFor - m.result.goalsAgainst;
      tally[diff > 0 ? 'won' : diff < 0 ? 'lost' : 'drawn']++;
    }
  }
  return tally;
}
