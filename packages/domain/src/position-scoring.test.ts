import { describe, expect, it } from 'vitest';

import { InvalidAnswersError, scorePosition, type ServedPositionItem } from './position-scoring.js';
import { POSITION_CODES, type MatchFormat, type PositionCode } from './positions.js';
import {
  prototypeComputeWinner,
  type PrototypeQuestion,
} from './test-support/prototype-orientation.js';
import { randomInt, seededRandom } from './test-support/random.js';

/** p1–p4 del prototipo, con ids de opción a–d en el orden de los datos. */
const PROTOTYPE_ITEMS: ServedPositionItem[] = [
  {
    id: 'p1',
    options: [
      { id: 'a', points: { MCD: 3, MC: 2, DFC: 1 } },
      { id: 'b', points: { DFC: 3, MCD: 1 } },
      { id: 'c', points: { LAT: 3, EXT: 2 } },
      { id: 'd', points: { DC: 3, EXT: 2 } },
    ],
  },
  {
    id: 'p2',
    options: [
      { id: 'a', points: { DFC: 3, POR: 1 } },
      { id: 'b', points: { DFC: 2, MCD: 2 } },
      { id: 'c', points: { MCD: 3, MC: 1 } },
      { id: 'd', points: { LAT: 3 } },
    ],
  },
  {
    id: 'p3',
    options: [
      { id: 'a', points: { DC: 4 } },
      { id: 'b', points: { EXT: 4 } },
      { id: 'c', points: { MP: 3, MC: 2 } },
      { id: 'd', points: { MP: 4 } },
    ],
  },
  {
    id: 'p4',
    options: [
      { id: 'a', points: { POR: 5 } },
      { id: 'b', points: { DFC: 3, DC: 2 } },
      { id: 'c', points: { EXT: 3, LAT: 2 } },
      { id: 'd', points: { MC: 3, MCD: 1 } },
    ],
  },
];
const ANSWERS = ['a', 'c', 'c', 'd'];

describe('scorePosition', () => {
  it('F11: afinidad normalizada por exposición y desempate por puntos ganados', () => {
    const ranking = scorePosition(PROTOTYPE_ITEMS, ANSWERS, 'F11');

    expect(ranking.map((r) => [r.pos, r.earned, r.maxp])).toEqual([
      // MC y MCD empatan en 100%: gana MC por haber ganado más puntos (8 > 7).
      ['MC', 8, 8],
      ['MCD', 7, 7],
      ['MP', 3, 4],
      ['DFC', 1, 9],
      // Sin puntos, orden canónico.
      ['POR', 0, 6],
      ['LAT', 0, 8],
      ['EXT', 0, 9],
      ['DC', 0, 9],
    ]);
    expect(ranking[2]?.pct).toBe(0.75);
  });

  it('F8: pliega MCD en MC y MP en DC, y solo compiten 6 posiciones', () => {
    const ranking = scorePosition(PROTOTYPE_ITEMS, ANSWERS, 'F8');

    expect(ranking.map((r) => [r.pos, r.earned, r.maxp])).toEqual([
      ['MC', 15, 15],
      ['DC', 3, 13],
      ['DFC', 1, 9],
      ['POR', 0, 6],
      ['LAT', 0, 8],
      ['EXT', 0, 9],
    ]);
  });

  it('una posición sin exposición tiene afinidad 0, no NaN', () => {
    const ranking = scorePosition([PROTOTYPE_ITEMS[2]!], ['a'], 'F11');
    expect(ranking.find((r) => r.pos === 'POR')).toEqual({
      pos: 'POR',
      pct: 0,
      earned: 0,
      maxp: 0,
    });
  });

  it('el orden en que salieron los ítems no cambia el resultado', () => {
    const reversed = scorePosition([...PROTOTYPE_ITEMS].reverse(), [...ANSWERS].reverse(), 'F11');
    expect(reversed).toEqual(scorePosition(PROTOTYPE_ITEMS, ANSWERS, 'F11'));
  });

  it('rechaza respuestas que no cuadran con los ítems servidos', () => {
    expect(() => scorePosition(PROTOTYPE_ITEMS, ['a'], 'F11')).toThrow(InvalidAnswersError);
    expect(() => scorePosition(PROTOTYPE_ITEMS, ['a', 'c', 'c', 'z'], 'F11')).toThrow(
      /no pertenece al ítem p4/,
    );
  });
});

describe('paridad con el prototipo (detector-posicion.jsx)', () => {
  /** Ítems al estilo del banco real: 4 opciones que reparten 1–5 puntos a 1–3 posiciones. */
  function randomItems(rand: () => number, count: number): ServedPositionItem[] {
    return Array.from({ length: count }, (_, i) => ({
      id: `q${i}`,
      options: Array.from({ length: 4 }, (_, j) => {
        const points: Partial<Record<PositionCode, number>> = {};
        for (let k = randomInt(rand, 1, 3); k > 0; k--) {
          points[POSITION_CODES[randomInt(rand, 0, 7)]!] = randomInt(rand, 1, 5);
        }
        return { id: `q${i}o${j}`, points };
      }),
    }));
  }

  function toPrototype(items: ServedPositionItem[]): PrototypeQuestion[] {
    return items.map((item) => ({
      id: item.id,
      options: item.options.map((o) => ({ label: o.id, pts: { ...o.points } })),
    }));
  }

  it.each<MatchFormat>(['F11', 'F8'])(
    '%s: mismas afinidades en 5.000 intentos aleatorios; solo cambia el orden en empates',
    (format) => {
      const rand = seededRandom(format === 'F11' ? 11 : 8);
      let tiesSeen = 0;

      for (let run = 0; run < 5000; run++) {
        const items = randomItems(rand, 15);
        const answers = items.map((item) => item.options[randomInt(rand, 0, 3)]!.id);

        const ours = scorePosition(items, answers, format);
        const questions = toPrototype(items);
        const theirs = prototypeComputeWinner(
          questions,
          answers.map((id, i) => questions[i]!.options.find((o) => o.label === id)!),
          format === 'F8' ? '8' : '11',
        );

        // Mismas posiciones con exactamente la misma afinidad.
        expect(Object.fromEntries(ours.map((r) => [r.pos, r.pct]))).toEqual(
          Object.fromEntries(theirs.map((r) => [r.pos, r.pct])),
        );
        // Mismo orden por afinidad; donde el prototipo dejaba el orden canónico, ahora
        // desempata el que ganó más puntos (02 §4).
        expect(ours.map((r) => r.pct)).toEqual(theirs.map((r) => r.pct));
        if (new Set(theirs.map((r) => r.pct)).size === theirs.length) {
          expect(ours.map((r) => r.pos)).toEqual(theirs.map((r) => r.pos));
        } else {
          tiesSeen++;
          ours.slice(1).forEach((r, i) => {
            const prev = ours[i]!;
            if (prev.pct !== r.pct) return;
            expect(
              prev.earned > r.earned ||
                (prev.earned === r.earned &&
                  POSITION_CODES.indexOf(prev.pos) < POSITION_CODES.indexOf(r.pos)),
            ).toBe(true);
          });
        }
      }

      // Asegura que el caso de empate se ejercitó de verdad.
      expect(tiesSeen).toBeGreaterThan(100);
    },
  );
});
