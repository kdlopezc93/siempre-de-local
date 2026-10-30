import { describe, expect, it } from 'vitest';

import {
  hasMatchStarted,
  isMatchEditable,
  isMatchOpen,
  MATCH_RATING_LABELS,
  isGame,
  matchKindProblem,
  matchTally,
  matchTallyByKind,
  replySummary,
  whoCame,
} from './matches.js';

describe('partidos (Fase 7)', () => {
  const startsAt = new Date('2026-11-01T15:00:00Z');

  it('abierto hasta la hora del partido; cancelado, nunca (D17)', () => {
    expect(isMatchOpen({ status: 'scheduled', startsAt }, new Date('2026-11-01T14:59:59Z'))).toBe(
      true,
    );
    expect(isMatchOpen({ status: 'scheduled', startsAt }, startsAt)).toBe(false);
    expect(isMatchOpen({ status: 'cancelled', startsAt }, new Date('2026-10-30T12:00:00Z'))).toBe(
      false,
    );
  });

  it('quién va, quién no y quién falta (solo los jugadores activos)', () => {
    const replies = new Map([
      ['ana', 'yes' as const],
      ['beto', 'no' as const],
      ['ya-no-esta', 'yes' as const],
    ]);
    expect(replySummary(['ana', 'beto', 'ciro'], replies)).toEqual({
      yes: ['ana'],
      no: ['beto'],
      pending: ['ciro'],
      injured: [],
    });
    // Un lesionado que no respondió no queda pendiente; si respondió, cuenta su respuesta.
    expect(replySummary(['ana', 'beto', 'ciro'], replies, new Set(['ana', 'ciro']))).toEqual({
      yes: ['ana'],
      no: ['beto'],
      pending: [],
      injured: ['ciro'],
    });
  });

  it('después del partido: se carga desde la hora del partido, nunca si se canceló (D18)', () => {
    expect(
      hasMatchStarted({ status: 'scheduled', startsAt }, new Date('2026-11-01T14:59:59Z')),
    ).toBe(false);
    expect(hasMatchStarted({ status: 'scheduled', startsAt }, startsAt)).toBe(true);
    expect(
      hasMatchStarted({ status: 'cancelled', startsAt }, new Date('2026-11-05T12:00:00Z')),
    ).toBe(false);
  });

  it('se corrige o se cancela hasta que tenga resultado, aunque ya haya pasado la hora', () => {
    expect(isMatchEditable({ status: 'scheduled', hasResult: false })).toBe(true);
    expect(isMatchEditable({ status: 'scheduled', hasResult: true })).toBe(false);
    expect(isMatchEditable({ status: 'cancelled', hasResult: false })).toBe(false);
  });

  it('el balance: ganados, empatados y perdidos entre los jugados; los cancelados aparte', () => {
    const played = (goalsFor: number, goalsAgainst: number) => ({
      status: 'scheduled' as const,
      result: { goalsFor, goalsAgainst },
    });
    expect(
      matchTally([
        played(3, 1),
        played(2, 2),
        played(0, 1),
        played(1, 0),
        { status: 'cancelled', result: null },
        // Programado sin resultado (por jugar o falta cargarlo): no cuenta.
        { status: 'scheduled', result: null },
      ]),
    ).toEqual({ played: 4, won: 2, drawn: 1, lost: 1, cancelled: 1 });
    expect(matchTally([])).toEqual({ played: 0, won: 0, drawn: 0, lost: 0, cancelled: 0 });
  });

  it('la escala de la evaluación va de Flojo a Figura', () => {
    expect(Object.values(MATCH_RATING_LABELS)).toEqual([
      'Flojo',
      'Regular',
      'Bien',
      'Muy bien',
      'Figura',
    ]);
  });

  it('tipo de convocatoria: rival y torneo según el tipo (2026-10-28)', () => {
    expect(matchKindProblem({ kind: 'training', opponent: null, tournamentId: null })).toBeNull();
    expect(matchKindProblem({ kind: 'training', opponent: 'Los Pibes', tournamentId: null })).toBe(
      'Un entrenamiento no tiene rival.',
    );
    expect(
      matchKindProblem({ kind: 'friendly', opponent: 'Los Pibes', tournamentId: null }),
    ).toBeNull();
    expect(matchKindProblem({ kind: 'friendly', opponent: null, tournamentId: null })).toBe(
      'Falta el rival.',
    );
    expect(matchKindProblem({ kind: 'friendly', opponent: 'Los Pibes', tournamentId: 't' })).toBe(
      'Un amistoso no es de un torneo.',
    );
    expect(
      matchKindProblem({ kind: 'championship', opponent: 'Los Pibes', tournamentId: null }),
    ).toBe('Elige el torneo.');
    expect(
      matchKindProblem({ kind: 'championship', opponent: 'Los Pibes', tournamentId: 't' }),
    ).toBeNull();
    expect(isGame('training')).toBe(false);
    expect(isGame('friendly')).toBe(true);
  });

  it('el balance va por tipo y los entrenamientos no suman', () => {
    const won = { status: 'scheduled' as const, result: { goalsFor: 2, goalsAgainst: 0 } };
    const tally = matchTallyByKind([
      { kind: 'championship', ...won },
      { kind: 'championship', status: 'cancelled', result: null },
      { kind: 'friendly', status: 'scheduled', result: { goalsFor: 1, goalsAgainst: 1 } },
      { kind: 'training', status: 'scheduled', result: null },
    ]);
    expect(tally.championship).toEqual({ played: 1, won: 1, drawn: 0, lost: 0, cancelled: 1 });
    expect(tally.friendly).toEqual({ played: 1, won: 0, drawn: 1, lost: 0, cancelled: 0 });
  });

  it('quién vino: sin lista, los que dijeron voy; con lista, la lista (2026-10-30)', () => {
    const replies = new Map([
      ['a', 'yes'],
      ['b', 'no'],
      ['c', 'yes'],
    ] as const);
    expect([...whoCame(replies, null)].sort()).toEqual(['a', 'c']);
    // La lista manda: llegó "b", que había dicho que no, y "c" no apareció.
    expect([...whoCame(replies, new Set(['a', 'b']))].sort()).toEqual(['a', 'b']);
    // Una lista vacía también es lista: no vino nadie.
    expect(whoCame(replies, new Set()).size).toBe(0);
  });
});
