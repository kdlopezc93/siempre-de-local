import type { MatchRoster } from '@sdl/contracts';
import { describe, expect, it } from 'vitest';

import { RATING_OPTIONS, whoPlayed } from './after-match';

const roster: MatchRoster = [
  { playerId: 'a', displayName: 'Ana', jerseyNumber: 4, reply: 'yes' },
  { playerId: 'b', displayName: 'Beto', jerseyNumber: 9, reply: 'no' },
  { playerId: 'c', displayName: 'Ciro', jerseyNumber: null, reply: 'yes' },
  { playerId: 'd', displayName: 'Dani', jerseyNumber: 2, reply: null },
];
const none = new Set<string>();

describe('después del partido: a quién evaluar (D18)', () => {
  it('sin alineación publicada, los que dijeron voy', () => {
    const { played, others } = whoPlayed({ roster, lineup: null, ratings: [], added: none });
    expect(played.map((p) => p.displayName)).toEqual(['Ana', 'Ciro']);
    expect(others.map((p) => p.displayName)).toEqual(['Beto', 'Dani']);
  });

  it('con alineación, titulares y banco; más los evaluados y los agregados, por dorsal', () => {
    const { played, others } = whoPlayed({
      roster,
      lineup: {
        matchId: 'm',
        format: 'F11',
        formation: '1-4-3-3',
        publishedAt: '2026-11-01T15:00:00.000Z',
        starters: [
          { slotId: 'POR', player: { id: 'b', displayName: 'Beto', jerseyNumber: 9 } },
          { slotId: 'LI', player: null },
        ],
        bench: [{ id: 'a', displayName: 'Ana', jerseyNumber: 4 }],
      },
      ratings: [
        {
          playerId: 'x',
          displayName: 'Ya no está',
          jerseyNumber: null,
          rating: 3,
          note: null,
          ratedBy: null,
          ratedAt: '2026-11-01T18:00:00.000Z',
        },
      ],
      added: new Set(['d']),
    });
    expect(played.map((p) => p.displayName)).toEqual(['Dani', 'Ana', 'Beto', 'Ya no está']);
    expect(others.map((p) => p.displayName)).toEqual(['Ciro']);
  });

  it('la escala, de Flojo a Figura', () => {
    expect(RATING_OPTIONS.map((o) => o.label)).toEqual([
      'Flojo',
      'Regular',
      'Bien',
      'Muy bien',
      'Figura',
    ]);
  });
});
