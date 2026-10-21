import {
  ELIGIBLE_POSITIONS,
  F8_FOLD,
  POSITION_CODES,
  type MatchFormat,
  type PositionCode,
} from './positions.js';

/** Versión del algoritmo del test de orientación; se guarda con cada resultado (03 §5). */
export const ORIENTATION_SCORING_VERSION = 'orientation-v1';

export type PositionPoints = Readonly<Partial<Record<PositionCode, number>>>;

/** Ítem de posición tal como se sirvió: sus opciones con los puntos que reparte cada una. */
export interface ServedPositionItem {
  id: string;
  options: readonly { id: string; points: PositionPoints }[];
}

export interface RankingEntry {
  pos: PositionCode;
  /** Afinidad 0–1: lo ganado sobre lo que esa posición podía ganar en los ítems servidos. */
  pct: number;
  earned: number;
  maxp: number;
}

export class InvalidAnswersError extends Error {
  override readonly name = 'InvalidAnswersError';
}

/**
 * Afinidad por posición normalizada por exposición, con plegado F8 y ranking
 * determinista (02 §4): pct desc → earned desc → orden canónico.
 *
 * `answers[i]` es el id de la opción elegida en `items[i]`.
 */
export function scorePosition(
  items: readonly ServedPositionItem[],
  answers: readonly string[],
  format: MatchFormat,
): RankingEntry[] {
  if (answers.length !== items.length) {
    throw new InvalidAnswersError(
      `Se esperaban ${items.length} respuestas y llegaron ${answers.length}`,
    );
  }

  const earned = zeroByPosition();
  const maxp = zeroByPosition();

  items.forEach((item, i) => {
    const chosen = item.options.find((option) => option.id === answers[i]);
    if (!chosen) {
      throw new InvalidAnswersError(`La opción ${answers[i]} no pertenece al ítem ${item.id}`);
    }
    for (const pos of POSITION_CODES) {
      // El máximo de cada posición en este ítem normaliza por exposición.
      maxp[pos] += Math.max(0, ...item.options.map((option) => option.points[pos] ?? 0));
      earned[pos] += chosen.points[pos] ?? 0;
    }
  });

  if (format === 'F8') {
    for (const [from, to] of Object.entries(F8_FOLD) as [PositionCode, PositionCode][]) {
      earned[to] += earned[from];
      maxp[to] += maxp[from];
    }
  }

  return ELIGIBLE_POSITIONS[format]
    .map((pos) => ({
      pos,
      pct: maxp[pos] > 0 ? earned[pos] / maxp[pos] : 0,
      earned: earned[pos],
      maxp: maxp[pos],
    }))
    .sort(
      (a, b) =>
        b.pct - a.pct ||
        b.earned - a.earned ||
        POSITION_CODES.indexOf(a.pos) - POSITION_CODES.indexOf(b.pos),
    );
}

function zeroByPosition(): Record<PositionCode, number> {
  return Object.fromEntries(POSITION_CODES.map((pos) => [pos, 0])) as Record<PositionCode, number>;
}
