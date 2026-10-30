import type { MatchRoster } from '@sdl/contracts';
import { describe, expect, it } from 'vitest';

import { RATING_OPTIONS, whoPlayed } from './after-match';

const roster: MatchRoster = [
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
    jerseyNumber: 9,
    reply: 'no',
    canRate: true,
    injured: false,
    came: false,
  },
  {
    playerId: 'c',
    displayName: 'Ciro',
    jerseyNumber: null,
    reply: 'yes',
    canRate: true,
    injured: false,
    came: false,
  },
  {
    playerId: 'd',
    displayName: 'Dani',
    jerseyNumber: 2,
    reply: null,
    canRate: true,
    injured: false,
    came: false,
  },
];

describe('después del partido: a quién evaluar (D18)', () => {
  it('sin alineación publicada, los que dijeron voy', () => {
    const { played, others } = whoPlayed({
      roster,
      lineup: null,
      ratings: [],
      attendanceTaken: false,
    });
    expect(played.map((p) => p.displayName)).toEqual(['Ana', 'Ciro']);
    expect(others.map((p) => p.displayName)).toEqual(['Beto', 'Dani']);
  });

  it('con alineación, titulares y banco; más los evaluados, por dorsal', () => {
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
      attendanceTaken: false,
    });
    expect(played.map((p) => p.displayName)).toEqual(['Ana', 'Beto', 'Ya no está']);
    expect(others.map((p) => p.displayName)).toEqual(['Ciro', 'Dani']);
  });

  it('con lista pasada ("¿Quién vino?"), los que vinieron: manda sobre la alineación y el voy', () => {
    const { played, others } = whoPlayed({
      roster: roster.map((p) => ({ ...p, came: p.playerId === 'b' || p.playerId === 'd' })),
      lineup: null,
      ratings: [],
      attendanceTaken: true,
    });
    expect(played.map((p) => p.displayName)).toEqual(['Dani', 'Beto']);
    expect(others.map((p) => p.displayName)).toEqual(['Ana', 'Ciro']);
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
