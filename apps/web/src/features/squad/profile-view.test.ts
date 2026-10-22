import type { SquadPlayer } from '@sdl/contracts';
import { describe, expect, it } from 'vitest';

import { jerseyHolders } from './profile-view';

const player = (userId: string, displayName: string, jerseyNumber: number | null) =>
  ({ userId, displayName, jerseyNumber }) as SquadPlayer;

describe('jerseyHolders', () => {
  it('quiénes más usan ese número, sin contar al propio jugador', () => {
    const players = [player('a', 'Ana', 10), player('b', 'Beto', 10), player('c', 'Caro', null)];
    expect(jerseyHolders(players, 10, 'a')).toEqual(['Beto']);
    expect(jerseyHolders(players, 7, 'a')).toEqual([]);
  });
});
