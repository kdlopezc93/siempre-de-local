import type { SquadPlayer } from '@sdl/contracts';
import { describe, expect, it } from 'vitest';

import { filterCounts, filterSquad, parseFilters, shownPosition } from './squad-filters';

let n = 0;
const player = (over: Partial<SquadPlayer>): SquadPlayer => ({
  userId: `0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f${String(10 + n++).padStart(2, '0')}`,
  displayName: 'X',
  jerseyNumber: null,
  preferredPositions: [],
  test: { status: 'none' },
  latestAssessment: null,
  assessedByMe: true,
  canRate: true,
  injury: null,
  knowledge: [],
  card: { ratedAt: '2026-10-01T00:00:00.000Z', position: null, positionAverages: {} },
  ...over,
});
const assessed = (primaryPosition: 'DFC' | 'MC' | 'POR' | 'DC') =>
  ({
    id: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f99',
    playerId: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f98',
    primaryPosition,
    secondaryPositions: [],
    confidence: 3,
    blind: true,
    notes: null,
    createdAt: '2026-10-01T00:00:00.000Z',
    coach: null,
  }) as unknown as SquadPlayer['latestAssessment'];

const ana = player({
  displayName: 'Ana Álvarez',
  jerseyNumber: 4,
  latestAssessment: assessed('DFC'),
});
const beto = player({
  displayName: 'Beto',
  jerseyNumber: 2,
  assessedByMe: false,
  card: null,
  preferredPositions: ['MC'],
});
const ciro = player({
  displayName: 'Ciro',
  jerseyNumber: null,
  test: {
    status: 'visible',
    attemptId: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f97',
    submittedAt: '2026-10-01T00:00:00.000Z',
    podium: ['DC', 'EXT', 'MP'],
  },
});
const squad = [ana, beto, ciro];

describe('filtros de la plantilla', () => {
  it('la URL: solo lo que se conoce', () => {
    expect([...parseFilters('por-valorar,defensa,cualquiera')]).toEqual(['por-valorar', 'defensa']);
    expect(parseFilters(null).size).toBe(0);
  });

  it('posición mostrada: cuerpo técnico, si no test visible, si no preferida', () => {
    expect([ana, beto, ciro].map(shownPosition)).toEqual(['DFC', 'MC', 'DC']);
  });

  it('busca sin tildes o por dorsal; ordena por dorsal', () => {
    const names = (q: string, f = '') =>
      filterSquad(squad, q, parseFilters(f)).map((p) => p.displayName);
    expect(names('')).toEqual(['Beto', 'Ana Álvarez', 'Ciro']);
    expect(names('alvarez')).toEqual(['Ana Álvarez']);
    expect(names('2')).toEqual(['Beto']);
  });

  it('en un grupo suman; entre grupos se cruzan', () => {
    const names = (f: string) => filterSquad(squad, '', parseFilters(f)).map((p) => p.displayName);
    expect(names('defensa,ataque')).toEqual(['Ana Álvarez', 'Ciro']);
    expect(names('por-valorar,sin-test')).toEqual(['Beto', 'Ana Álvarez']);
    expect(names('por-valorar,medio')).toEqual(['Beto']);
    expect(names('por-valorar,defensa')).toEqual([]);
  });

  it('por valorar: solo a quienes puede valorar quien mira', () => {
    const pending = player({ assessedByMe: false });
    const staff = player({ assessedByMe: false, canRate: false });
    expect(filterSquad([pending, staff], '', parseFilters('por-valorar'))).toEqual([pending]);
  });

  it('conteos por filtro', () => {
    expect(filterCounts(squad)).toMatchObject({
      'por-valorar': 1,
      'sin-tarjeta': 1,
      'sin-test': 2,
      defensa: 1,
      medio: 1,
      ataque: 1,
      portero: 0,
    });
  });
});
