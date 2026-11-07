import type { Match } from '@sdl/contracts';

import { namesList } from './share-messages';

/*
 * Lo que dicen los afiches del resultado (2026-11-06, Kevin aprobó la maqueta): cómo nos fue,
 * los goleadores agrupados con sus pases y los números de la figura. Puro, sin dibujo.
 */

export type MatchResult = NonNullable<Match['result']>;
export type Verdict = 'win' | 'draw' | 'loss';

export const VERDICT_WORD: Record<Verdict, string> = {
  win: 'Ganamos',
  draw: 'Empatamos',
  loss: 'Perdimos',
};

export const verdictOf = (r: Pick<MatchResult, 'goalsFor' | 'goalsAgainst'>): Verdict =>
  r.goalsFor > r.goalsAgainst ? 'win' : r.goalsFor < r.goalsAgainst ? 'loss' : 'draw';

/** El nombre de pila: "Santiago" de "Santiago Ruiz". */
export const firstName = (name: string): string => name.trim().split(/\s+/)[0] ?? name;

/** "Santiago" y "Ruiz Gómez"; con un solo nombre, el resto vacío. */
export function nameParts(name: string): [string, string] {
  const [first = name, ...rest] = name.trim().split(/\s+/);
  return [first, rest.join(' ')];
}

export interface ScorerLine {
  /** "Santiago Ruiz", "Autogol del rival" o "Sin saber quién". */
  name: string;
  /** Para el mensaje: "Santiago", "autogol", "sin saber quién". */
  short: string;
  count: number;
  /** "Pase de Pipe", "Pases de Pipe y Camilo" o vacío. */
  how: string;
}

/** Los goles agrupados por goleador, en el orden del primero de cada uno. */
export function scorerLines(goals: MatchResult['goals']): ScorerLine[] {
  const lines = new Map<
    string,
    { name: string; short: string; count: number; assists: string[] }
  >();
  for (const goal of goals) {
    const key = goal.ownGoal ? 'own' : (goal.scorer?.id ?? 'unknown');
    const line = lines.get(key) ?? {
      name: goal.ownGoal ? 'Autogol del rival' : (goal.scorer?.displayName ?? 'Sin saber quién'),
      short: goal.ownGoal
        ? 'autogol'
        : goal.scorer
          ? firstName(goal.scorer.displayName)
          : 'sin saber quién',
      count: 0,
      assists: [],
    };
    line.count += 1;
    const assist = goal.assist && firstName(goal.assist.displayName);
    if (assist && !line.assists.includes(assist)) line.assists.push(assist);
    lines.set(key, line);
  }
  return [...lines.values()].map(({ assists, ...line }) => ({
    ...line,
    how:
      assists.length === 0
        ? ''
        : `${assists.length > 1 ? 'Pases' : 'Pase'} de ${namesList(assists)}`,
  }));
}

/** Los goles y pases de gol de alguien en el partido. */
export function playerStats(result: MatchResult, playerId: string) {
  return {
    goals: result.goals.filter((g) => !g.ownGoal && g.scorer?.id === playerId).length,
    assists: result.goals.filter((g) => g.assist?.id === playerId).length,
  };
}

/** "2 goles", "1 asistencia": los números de la figura que vale la pena mostrar. */
export function statLabels(stats: { goals: number; assists: number }): [number, string][] {
  const labels: [number, string][] = [];
  if (stats.goals) labels.push([stats.goals, stats.goals === 1 ? 'gol' : 'goles']);
  if (stats.assists)
    labels.push([stats.assists, stats.assists === 1 ? 'asistencia' : 'asistencias']);
  return labels;
}

/**
 * El mensaje que acompaña el afiche: "⚽ *Ganamos 3–1 a Real Bosa*", los goles y la figura, y el
 * enlace al partido.
 */
export function resultMessage(
  match: Pick<Match, 'opponent'>,
  result: MatchResult,
  url: string,
): string {
  const verdict = verdictOf(result);
  const score = `${result.goalsFor}–${result.goalsAgainst}`;
  const rival = match.opponent ?? 'el rival';
  const head =
    verdict === 'win'
      ? `⚽ *Ganamos ${score} a ${rival}*`
      : `⚽ *${VERDICT_WORD[verdict]} ${score} con ${rival}*`;
  const goals = scorerLines(result.goals)
    .map((l) => (l.count > 1 ? `${l.short} (${l.count})` : l.short))
    .join(', ');
  return [
    head,
    goals && `Goles: ${goals}`,
    result.figure && `Figura: ${result.figure.displayName}`,
    `Mira el partido 👉 ${url}`,
  ]
    .filter(Boolean)
    .join('\n');
}
