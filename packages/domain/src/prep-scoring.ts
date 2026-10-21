import { InvalidAnswersError } from './position-scoring.js';

/**
 * Ítem de preparación tal como se sirvió. La correcta va por id de opción (02 §5) y
 * este cálculo solo corre en el servidor: la PWA nunca recibe `correctOptionId`.
 */
export interface ServedPrepItem {
  id: string;
  optionIds: readonly string[];
  correctOptionId: string;
}

export type PrepBand = 'very_prepared' | 'good' | 'reinforce' | 'room_to_grow';

export interface PrepResult {
  score: number;
  total: number;
  band: PrepBand;
}

/** Aciertos sobre los ítems servidos (8 de la posición ganadora). */
export function scorePrep(
  items: readonly ServedPrepItem[],
  answers: readonly string[],
): PrepResult {
  if (answers.length !== items.length) {
    throw new InvalidAnswersError(
      `Se esperaban ${items.length} respuestas y llegaron ${answers.length}`,
    );
  }

  let score = 0;
  items.forEach((item, i) => {
    const answer = answers[i]!;
    if (!item.optionIds.includes(answer)) {
      throw new InvalidAnswersError(`La opción ${answer} no pertenece al ítem ${item.id}`);
    }
    if (answer === item.correctOptionId) score++;
  });

  return { score, total: items.length, band: prepBand(score, items.length) };
}

/** Bandas de 02 §5: ≥ 0.85 · ≥ 0.60 · ≥ 0.375 · resto. */
export function prepBand(score: number, total: number): PrepBand {
  const ratio = total > 0 ? score / total : 0;
  if (ratio >= 0.85) return 'very_prepared';
  if (ratio >= 0.6) return 'good';
  if (ratio >= 0.375) return 'reinforce';
  return 'room_to_grow';
}
