import { describe, expect, it } from 'vitest';

import {
  chargeContext,
  chargeTitle,
  dueLine,
  parsePesos,
  pesos,
  shareBadge,
  summaryMarks,
  vacaMarks,
} from './charge-view';

describe('cobros en la app', () => {
  it('la plata: punto de miles y sin decimales; el campo acepta lo que escriban', () => {
    expect(pesos(70_000)).toBe('$70.000');
    expect(pesos(5_400)).toBe('$5.400');
    expect(pesos(0)).toBe('$0');
    expect(parsePesos('70.000')).toBe(70_000);
    expect(parsePesos('$ 23400')).toBe(23_400);
    expect(parsePesos('')).toBeNull();
  });

  it('el nombre y de qué es', () => {
    expect(chargeTitle({ kind: 'vaca', title: null })).toBe('Vaca');
    expect(chargeTitle({ kind: 'fine', title: 'Amarilla' })).toBe('Amarilla');
    expect(
      chargeContext({
        match: { id: 'm', opponent: 'Los Pibes', startsAt: '2026-11-02T20:00:00.000Z' },
        tournament: null,
      }),
    ).toMatch(/^Contra Los Pibes, /);
    expect(chargeContext({ match: null, tournament: { id: 't', name: 'Copa del barrio' } })).toBe(
      'Copa del barrio',
    );
    expect(chargeContext({ match: null, tournament: null })).toBeNull();
    expect(dueLine('2026-11-05')).toBe('vence el 5 nov');
  });

  it('la fila de la vaca: pagaron, abonaron y deben, en ese orden y en palabras', () => {
    expect(vacaMarks([{ status: 'pending' }, { status: 'paid' }, { status: 'partial' }])).toEqual({
      marks: ['paid', 'partial', 'pending'],
      label: '1 pagó, 1 abonó y 1 debe',
    });
    expect(vacaMarks([{ status: 'paid' }, { status: 'paid' }]).label).toBe('2 pagaron');
    expect(summaryMarks({ people: 3, paidPeople: 1 }).label).toBe('1 pagó y 2 deben');
  });

  it('el estado de cada uno, con palabra', () => {
    expect(shareBadge({ status: 'paid', reported: 0 }).label).toBe('Pagó');
    expect(shareBadge({ status: 'pending', reported: 23_400 }).label).toBe('Por confirmar');
    expect(shareBadge({ status: 'partial', reported: 0 }).label).toBe('Abonó');
    expect(shareBadge({ status: 'pending', reported: 0 }).label).toBe('Debe');
    expect(shareBadge({ status: 'covered', reported: 0 }).label).toBe('La cubre el equipo');
    expect(shareBadge({ status: 'covered', reported: 0 }, true).label).toBe('Te la cubrieron');
    expect(shareBadge({ status: 'paid', reported: 0 }, true).label).toBe('Pagaste');
  });
});
