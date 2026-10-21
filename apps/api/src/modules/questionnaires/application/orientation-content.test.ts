import { POSITION_CODES } from '@sdl/domain';
import { describe, expect, it } from 'vitest';

import { ORIENTATION_V1 } from '../infrastructure/seed/orientation-v1.content.js';
import { type OrientationContent, validateOrientationContent } from './orientation-content.js';

describe('contenido v1 del test de orientación', () => {
  it('tiene 31 ítems de posición y 8 de preparación por posición, y es publicable', () => {
    expect(ORIENTATION_V1.positionItems).toHaveLength(31);
    for (const pos of POSITION_CODES) expect(ORIENTATION_V1.prepItems[pos]).toHaveLength(8);
    expect(validateOrientationContent(ORIENTATION_V1)).toEqual([]);
  });

  it('la correcta de preparación ya no está siempre en la misma posición', () => {
    const correctIndexes = new Set(
      POSITION_CODES.flatMap((pos) =>
        ORIENTATION_V1.prepItems[pos].map((item) => item.options.findIndex((o) => o.isCorrect)),
      ),
    );
    expect(correctIndexes).toEqual(new Set([0, 1, 2, 3]));
  });
});

describe('validateOrientationContent', () => {
  function withChange(change: (content: OrientationContent) => void): string[] {
    const content = structuredClone(ORIENTATION_V1);
    change(content);
    return validateOrientationContent(content);
  }

  it('detecta un ítem de preparación sin correcta o con dos', () => {
    expect(
      withChange((c) => {
        c.prepItems.DFC[0]!.options.forEach((o) => (o.isCorrect = false));
        c.prepItems.POR[2]!.options.forEach((o) => (o.isCorrect = true));
      }),
    ).toEqual([
      'Preparación de POR #3: 4 correctas (debe ser 1)',
      'Preparación de DFC #1: 0 correctas (debe ser 1)',
    ]);
  });

  it('detecta puntos inválidos, códigos repetidos y pocos ítems', () => {
    expect(
      withChange((c) => {
        c.positionItems[0]!.options[0]!.points = { DC: 0 };
        c.positionItems[1]!.code = c.positionItems[2]!.code;
        c.positionItemsPerAttempt = 40;
      }),
    ).toEqual([
      'Hay 31 ítems de posición y cada intento sirve 40',
      'Hay códigos de ítem repetidos',
      'p1: puntos inválidos para DC',
    ]);
  });
});
