import { describe, expect, it } from 'vitest';

import { isMatchOpen, replySummary } from './matches.js';

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
    });
  });
});
