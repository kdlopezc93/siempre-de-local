import { describe, expect, it } from 'vitest';

import { listed, MAX_LISTED, rowSize } from './matchday-image';

describe('el afiche "Día de partido" (2026-11-10)', () => {
  it('con muchos convocados, el último renglón dice cuántos más', () => {
    const few = Array.from({ length: 14 }, (_, i) => i);
    expect(listed(few)).toEqual({ shown: few, more: 0 });
    const many = Array.from({ length: 30 }, (_, i) => i);
    const { shown, more } = listed(many);
    expect(shown).toHaveLength(MAX_LISTED - 1);
    expect(shown.length + more).toBe(30);
  });

  it('los renglones se achican para caber, sin pasar de su tamaño grande', () => {
    expect(rowSize(3, 406)).toEqual({ row: 78, disc: 31, text: 34 });
    const crowded = rowSize(12, 406);
    expect(crowded.row * 12).toBeLessThanOrEqual(406);
    expect(crowded.text).toBeLessThan(34);
  });
});
