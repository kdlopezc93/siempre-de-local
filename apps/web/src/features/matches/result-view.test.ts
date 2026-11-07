import { describe, expect, it } from 'vitest';

import {
  nameParts,
  playerStats,
  resultMessage,
  scorerLines,
  statLabels,
  verdictOf,
  type MatchResult,
} from './result-view';

const p = (id: string, displayName: string, jerseyNumber: number | null = null) => ({
  id: `00000000-0000-4000-8000-00000000000${id}`,
  displayName,
  jerseyNumber,
});
const santi = p('1', 'Santiago Ruiz', 10);
const pipe = p('2', 'Pipe Gómez', 7);
const camilo = p('3', 'Camilo Torres');

const result: MatchResult = {
  goalsFor: 3,
  goalsAgainst: 1,
  figure: santi,
  goals: [
    { scorer: santi, assist: pipe, ownGoal: false },
    { scorer: null, assist: null, ownGoal: true },
    { scorer: santi, assist: camilo, ownGoal: false },
  ],
  cards: [],
  at: '2026-11-08T22:00:00.000Z',
};

describe('result-view', () => {
  it('cómo nos fue', () => {
    expect(verdictOf({ goalsFor: 3, goalsAgainst: 1 })).toBe('win');
    expect(verdictOf({ goalsFor: 2, goalsAgainst: 2 })).toBe('draw');
    expect(verdictOf({ goalsFor: 0, goalsAgainst: 2 })).toBe('loss');
  });

  it('agrupa los goles por goleador, con sus pases, en el orden del primero', () => {
    expect(scorerLines(result.goals)).toEqual([
      { name: 'Santiago Ruiz', short: 'Santiago', count: 2, how: 'Pases de Pipe y Camilo' },
      { name: 'Autogol del rival', short: 'autogol', count: 1, how: '' },
    ]);
    expect(scorerLines([{ scorer: null, assist: pipe, ownGoal: false }])).toEqual([
      { name: 'Sin saber quién', short: 'sin saber quién', count: 1, how: 'Pase de Pipe' },
    ]);
  });

  it('los números de la figura', () => {
    expect(playerStats(result, santi.id)).toEqual({ goals: 2, assists: 0 });
    expect(playerStats(result, pipe.id)).toEqual({ goals: 0, assists: 1 });
    expect(statLabels({ goals: 2, assists: 1 })).toEqual([
      [2, 'goles'],
      [1, 'asistencia'],
    ]);
    expect(statLabels({ goals: 0, assists: 0 })).toEqual([]);
  });

  it('parte el nombre para el afiche de la figura', () => {
    expect(nameParts('Santiago Ruiz Gómez')).toEqual(['Santiago', 'Ruiz Gómez']);
    expect(nameParts('Pele')).toEqual(['Pele', '']);
  });

  it('el mensaje para el grupo', () => {
    expect(resultMessage({ opponent: 'Real Bosa' }, result, 'https://app/x')).toBe(
      [
        '⚽ *Ganamos 3–1 a Real Bosa*',
        'Goles: Santiago (2), autogol',
        'Figura: Santiago Ruiz',
        'Mira el partido 👉 https://app/x',
      ].join('\n'),
    );
    expect(
      resultMessage(
        { opponent: 'Atlético Suba' },
        { ...result, goalsFor: 0, goalsAgainst: 2, goals: [], figure: null },
        'https://app/x',
      ),
    ).toBe(['⚽ *Perdimos 0–2 con Atlético Suba*', 'Mira el partido 👉 https://app/x'].join('\n'));
  });
});
