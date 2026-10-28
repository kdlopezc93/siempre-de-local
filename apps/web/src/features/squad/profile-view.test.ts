import type { PlayerProfileResponse, SquadPlayer } from '@sdl/contracts';
import { describe, expect, it } from 'vitest';

import { jerseyHolders, knowledgeAt } from './profile-view';

const player = (userId: string, displayName: string, jerseyNumber: number | null) =>
  ({ userId, displayName, jerseyNumber }) as SquadPlayer;

describe('jerseyHolders', () => {
  it('quiénes más usan ese número, sin contar al propio jugador', () => {
    const players = [player('a', 'Ana', 10), player('b', 'Beto', 10), player('c', 'Caro', null)];
    expect(jerseyHolders(players, 10, 'a')).toEqual(['Beto']);
    expect(jerseyHolders(players, 7, 'a')).toEqual([]);
  });
});

describe('knowledgeAt', () => {
  const profile = {
    knowledge: {
      positions: [
        { position: 'POR', best: { pct: 0.95 } },
        { position: 'DFC', best: null },
        { position: 'MC', best: { pct: 0.6 } },
      ],
    },
  } as unknown as PlayerProfileResponse;

  it('el de su posición, aunque tenga uno mejor en otra', () => {
    expect(knowledgeAt(profile, 'MC')).toEqual({ position: 'MC', pct: 0.6 });
  });

  it('sin presentar en su posición: pct null, no el mejor de otra', () => {
    expect(knowledgeAt(profile, 'DFC')).toEqual({ position: 'DFC', pct: null });
  });

  it('sin posición, el mejor que tenga', () => {
    expect(knowledgeAt(profile, null)).toEqual({ position: 'POR', pct: 0.95 });
  });
});
