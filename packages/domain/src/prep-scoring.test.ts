import { describe, expect, it } from 'vitest';

import { InvalidAnswersError } from './position-scoring.js';
import { prepBand, scorePrep, type PrepBand, type ServedPrepItem } from './prep-scoring.js';

/** 8 ítems con la correcta en posiciones distintas: nada de "siempre la primera". */
const ITEMS: ServedPrepItem[] = Array.from({ length: 8 }, (_, i) => ({
  id: `prep${i}`,
  optionIds: ['a', 'b', 'c', 'd'].map((o) => `${i}${o}`),
  correctOptionId: `${i}${'abcd'[i % 4]}`,
}));

/** Mensajes de `Result` en detector-posicion.jsx, por umbral. */
function prototypeBand(prepScore: number, prepTotal: number): PrepBand {
  const r = prepScore / prepTotal;
  if (r >= 0.85) return 'very_prepared';
  if (r >= 0.6) return 'good';
  if (r >= 0.375) return 'reinforce';
  return 'room_to_grow';
}

describe('scorePrep', () => {
  it('cuenta aciertos por id de opción', () => {
    const answers = ITEMS.map((item, i) =>
      i < 5 ? item.correctOptionId : item.optionIds.find((o) => o !== item.correctOptionId)!,
    );
    expect(scorePrep(ITEMS, answers)).toEqual({ score: 5, total: 8, band: 'good' });
  });

  it('rechaza respuestas que no cuadran con los ítems servidos', () => {
    expect(() => scorePrep(ITEMS, ['0a'])).toThrow(InvalidAnswersError);
    const answers = ITEMS.map((item) => item.correctOptionId);
    answers[3] = '0a';
    expect(() => scorePrep(ITEMS, answers)).toThrow(/no pertenece al ítem prep3/);
  });

  it.each([
    [8, 'very_prepared'],
    [7, 'very_prepared'],
    [6, 'good'],
    [5, 'good'],
    [4, 'reinforce'],
    [3, 'reinforce'],
    [2, 'room_to_grow'],
    [0, 'room_to_grow'],
  ] as const)('%i/8 → %s, igual que el prototipo', (score, band) => {
    expect(prepBand(score, 8)).toBe(band);
    expect(prototypeBand(score, 8)).toBe(band);
  });
});
