import { describe, expect, it } from 'vitest';

import { convocados, listed, MAX_LISTED, rowSize } from './matchday-image';

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
    expect(rowSize(3, 406)).toEqual({ row: 92, disc: 32, text: 38 });
    const crowded = rowSize(12, 406);
    expect(crowded.row * 12).toBeLessThanOrEqual(406);
    expect(crowded.text).toBeLessThan(38);
  });

  it('convocados: los de la alineación publicada (titulares y banca); si no, los que van', () => {
    const p = (displayName: string, jerseyNumber: number | null = null) => ({
      id: displayName,
      displayName,
      jerseyNumber,
    });
    const roster = [
      {
        playerId: 'a',
        displayName: 'Ana',
        jerseyNumber: 4,
        reply: 'yes',
        canRate: true,
        injured: false,
        came: false,
      },
      {
        playerId: 'b',
        displayName: 'Beto',
        jerseyNumber: 5,
        reply: 'yes',
        canRate: true,
        injured: true,
        came: false,
      },
      {
        playerId: 'c',
        displayName: 'Ciro',
        jerseyNumber: null,
        reply: 'no',
        canRate: true,
        injured: false,
        came: false,
      },
    ] as Parameters<typeof convocados>[0];
    expect(convocados(roster, null)).toEqual([{ displayName: 'Ana', jerseyNumber: 4 }]);
    expect(
      convocados(roster, {
        starters: [
          { slotId: 'POR', player: p('Ronnie', 1) },
          { slotId: 'DFC', player: null },
        ],
        bench: [p('Ciro')],
      }),
    ).toEqual([
      { displayName: 'Ronnie', jerseyNumber: 1 },
      { displayName: 'Ciro', jerseyNumber: null },
    ]);
  });
});
