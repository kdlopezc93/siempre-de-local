import { describe, expect, it } from 'vitest';

import {
  hypergeometricQuantile,
  lintOrientation,
  orientationCoverage,
  type OrientationDraft,
} from './orientation-lint.js';
import { POSITION_CODES, type PositionCode } from './positions.js';

/** Un banco donde cada posición tiene `strong` preguntas que apuntan a ella. */
function draft(strong: number, perAttempt = 20): OrientationDraft {
  // Dos preguntas por vuelta, cada una con cuatro posiciones distintas (una por opción).
  const halves: PositionCode[][] = [POSITION_CODES.slice(0, 4), POSITION_CODES.slice(4)];
  const items = Array.from({ length: strong }).flatMap((_, round) =>
    halves.map((four, h) => ({
      code: `p${round * 2 + h + 1}`,
      context: 'situation' as const,
      text: `Pregunta ${round * 2 + h + 1}`,
      options: four.map((pos, i) => ({ label: `Opción ${i}`, points: { [pos]: 3 } })),
    })),
  );
  return { positionItemsPerAttempt: perAttempt, positionItems: items };
}

describe('control del test de orientación (Fase 8)', () => {
  it('cuenta exacta de cuántas fuertes le tocan a una posición por intento', () => {
    expect(hypergeometricQuantile(40, 10, 20, 0.1)).toBe(3);
    expect(hypergeometricQuantile(40, 11, 20, 0.1)).toBe(4);
    expect(hypergeometricQuantile(10, 10, 5, 0.1)).toBe(5);
    expect(hypergeometricQuantile(31, 0, 20, 0.1)).toBe(0);
  });

  it('una opción apunta a una posición si le da 3 o más y es la que más recibe', () => {
    const one = (points: Partial<Record<PositionCode, number>>) =>
      orientationCoverage({
        positionItemsPerAttempt: 1,
        positionItems: [
          {
            code: 'p1',
            context: 'situation',
            text: 'x',
            options: [{ label: 'a', points }],
          },
        ],
      });
    const strongOf = (cov: ReturnType<typeof one>, p: PositionCode) =>
      cov.find((c) => c.position === p)!;
    expect(strongOf(one({ LAT: 3, EXT: 2 }), 'LAT').strong).toBe(1);
    expect(strongOf(one({ LAT: 3, EXT: 2 }), 'EXT')).toMatchObject({ scoring: 1, strong: 0 });
    expect(strongOf(one({ LAT: 3, EXT: 4 }), 'LAT').strong).toBe(0);
    expect(strongOf(one({ LAT: 2 }), 'LAT').strong).toBe(0);
  });

  it('11 fuertes por posición pasa sin avisos; 10 avisa en cada posición', () => {
    expect(lintOrientation(draft(11))).toEqual([]);
    const issues = lintOrientation(draft(10));
    expect(issues.every((i) => i.level === 'warning')).toBe(true);
    expect(issues.filter((i) => i.rule === 'coverage')).toHaveLength(POSITION_CODES.length);
  });

  it('errores de estructura: opciones, puntos, posiciones y repetidos', () => {
    const base = draft(11);
    const [first, ...rest] = base.positionItems;
    const broken: OrientationDraft = {
      positionItemsPerAttempt: 20,
      positionItems: [
        {
          ...first!,
          options: [
            { label: 'Igual', points: { LAT: 6 } },
            { label: 'igual', points: {} },
            { label: 'Otra', points: { LAT: 1, EXT: 1, DC: 1, MC: 1 } },
          ],
        },
        { ...rest[0]!, code: first!.code },
        ...rest.slice(1),
      ],
    };
    expect(
      lintOrientation(broken)
        .filter((i) => i.level === 'error')
        .map((i) => i.rule)
        .sort(),
    ).toEqual([
      'duplicate-code',
      'duplicate-option',
      'option-positions',
      'option-positions',
      'options',
      'points',
    ]);
  });
});
