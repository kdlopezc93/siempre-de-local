import { describe, expect, it } from 'vitest';

import { hasMatchStarted, isMatchOpen, MATCH_RATING_LABELS, replySummary } from './matches.js';

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

  it('la escala de la evaluación va de Flojo a Figura', () => {
    expect(Object.values(MATCH_RATING_LABELS)).toEqual([
      'Flojo',
      'Regular',
      'Bien',
      'Muy bien',
      'Figura',
    ]);
  });
});
