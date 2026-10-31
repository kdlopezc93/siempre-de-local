import { describe, expect, it } from 'vitest';

import {
  chargeBalance,
  chargeProblem,
  payable,
  shareAmount,
  shareStatus,
  splitTotal,
  sponsorProblem,
} from './charges.js';

describe('cobros (06 Cobros)', () => {
  it('repartir un total: cada parte sube a los $100 siguientes y se dice cuánto sobra', () => {
    expect(splitTotal(70_000, 13)).toEqual({ share: 5_400, surplus: 200 });
    expect(splitTotal(60_000, 12)).toEqual({ share: 5_000, surplus: 0 });
    expect(splitTotal(150, 1)).toEqual({ share: 200, surplus: 50 });
    expect(() => splitTotal(10_000, 0)).toThrow(RangeError);
  });

  it('valor por persona tal cual; un total, repartido', () => {
    expect(shareAmount('per_person', 40_000, 15)).toBe(40_000);
    expect(shareAmount('total', 70_000, 13)).toBe(5_400);
  });

  it('qué falta para crear el cobro', () => {
    const ok = {
      kind: 'vaca',
      amount: 5_000,
      people: 3,
      matchId: 'm',
      tournamentId: null,
    } as const;
    expect(chargeProblem(ok)).toBeNull();
    expect(chargeProblem({ ...ok, amount: 0 })).toBe('Pon cuánto es.');
    expect(chargeProblem({ ...ok, amount: 2.5 })).toBe('Pon cuánto es.');
    expect(chargeProblem({ ...ok, amount: 100_000_001 })).toBe('Ese valor es demasiado alto.');
    expect(chargeProblem({ ...ok, people: 0 })).toBe('Elige a quién se le cobra.');
    expect(chargeProblem({ ...ok, kind: 'fine' })).toBe('Una multa es de una sola persona.');
    expect(chargeProblem({ ...ok, kind: 'fine', people: 1 })).toBeNull();
    expect(chargeProblem({ ...ok, tournamentId: 't' })).toMatch(/partido o de un torneo/);
  });

  it('pagó, abonó o no ha pagado; lo que todavía se puede pagar', () => {
    expect(shareStatus(40_000, 40_000)).toBe('paid');
    expect(shareStatus(40_000, 10_000)).toBe('partial');
    expect(shareStatus(40_000, 0)).toBe('pending');
    // Una parte en cero (la asumió el equipo) ya está paga.
    expect(shareStatus(0, 0)).toBe('paid');
    expect(payable(40_000, 10_000, 20_000)).toBe(10_000);
    expect(payable(40_000, 40_000, 0)).toBe(0);
  });

  it('el saldo: cobrado, entró y falta (lo pagado de más no resta lo que deben otros)', () => {
    expect(
      chargeBalance([
        { amount: 5_400, paid: 5_400 },
        { amount: 5_400, paid: 2_000 },
        { amount: 5_400, paid: 0 },
      ]),
    ).toEqual({ billed: 16_200, collected: 7_400, pending: 8_800 });
  });

  it('patrocinar: nunca a sí mismo, y solo mientras la parte no tenga pagos', () => {
    const free = { self: false, confirmed: 0, reported: 0 };
    expect(sponsorProblem(free)).toBeNull();
    expect(sponsorProblem({ ...free, self: true })).toMatch(/sí mismo/);
    expect(sponsorProblem({ ...free, confirmed: 2_000 })).toMatch(/ya tiene pagos/);
    expect(sponsorProblem({ ...free, reported: 2_000 })).toMatch(/por confirmar/);
  });
});
