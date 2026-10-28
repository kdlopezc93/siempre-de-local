/**
 * Partidos (Fase 7, `02` §12): el cuerpo técnico convoca, cada jugador responde voy / no voy
 * y la alineación se publica para todo el equipo. Reglas puras; el reloj lo pasa quien llama.
 */
export type MatchStatus = 'scheduled' | 'cancelled';
export type MatchReply = 'yes' | 'no';

/**
 * Tipo de convocatoria (2026-10-28, Kevin): de campeonato (con su torneo), amistoso o
 * entrenamiento. El entrenamiento es solo convocatoria y asistencia: sin rival, sin alineación,
 * sin resultado ni evaluaciones, y no suma al balance.
 */
export type MatchKind = 'championship' | 'friendly' | 'training';

export const MATCH_KIND_LABELS: Readonly<Record<MatchKind, string>> = {
  championship: 'Campeonato',
  friendly: 'Amistoso',
  training: 'Entrenamiento',
};

/** Lo que es "de partido": rival, alineación, resultado, figura y evaluaciones. */
export function isGame(kind: MatchKind): boolean {
  return kind !== 'training';
}

/**
 * Qué datos lleva cada tipo al convocar: el rival, salvo el entreno; el torneo, solo el de
 * campeonato (obligatorio en los nuevos; los que ya existían quedaron sin torneo y se les asigna
 * después). Devuelve el problema en palabras, o null si está bien.
 */
export function matchKindProblem(input: {
  kind: MatchKind;
  opponent: string | null;
  tournamentId: string | null;
}): string | null {
  if (input.kind === 'training') {
    if (input.opponent) return 'Un entrenamiento no tiene rival.';
    if (input.tournamentId) return 'Un entrenamiento no es de un torneo.';
    return null;
  }
  if (!input.opponent) return 'Falta el rival.';
  if (input.kind === 'championship' && !input.tournamentId) return 'Elige el torneo.';
  if (input.kind === 'friendly' && input.tournamentId) return 'Un amistoso no es de un torneo.';
  return null;
}

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
 * cancelados se cuentan aparte para saber cuántos se nos han caído. Quien llama pasa los de un
 * solo tipo (ver `matchTallyByKind`).
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

export type MatchTally = ReturnType<typeof matchTally>;

/**
 * El balance separado por tipo (2026-10-28): campeonato y amistosos, cada uno con el suyo; los
 * entrenamientos no suman.
 */
export function matchTallyByKind(
  matches: readonly {
    kind: MatchKind;
    status: MatchStatus;
    result: { goalsFor: number; goalsAgainst: number } | null;
  }[],
): { championship: MatchTally; friendly: MatchTally } {
  return {
    championship: matchTally(matches.filter((m) => m.kind === 'championship')),
    friendly: matchTally(matches.filter((m) => m.kind === 'friendly')),
  };
}
