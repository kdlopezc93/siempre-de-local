import { describe, expect, it } from 'vitest';

import { POSITION_CODES } from './positions.js';
import {
  anchorFor,
  assertValidRating,
  InvalidRatingError,
  positionAverages,
  RATING_WEIGHTS_V1,
} from './rating.js';

const OUTFIELD = { PAC: 80, SHO: 60, PAS: 70, DRI: 75, DEF: 40, PHY: 65 };
const GOALKEEPER = { GK_DIV: 70, GK_HAN: 60, GK_KIC: 50, GK_REF: 80, GK_SPD: 70, GK_POS: 65 };

describe('rating-formula-v1', () => {
  it('cada posición tiene sus pesos y suman 1', () => {
    for (const pos of POSITION_CODES) {
      const sum = Object.values(RATING_WEIGHTS_V1[pos]).reduce((a, b) => a + b, 0);
      expect(sum, pos).toBeCloseTo(1, 10);
    }
  });

  it('media por posición: Σ peso · valor, redondeada (02 §7.3)', () => {
    const mp = positionAverages(OUTFIELD);
    // EXT = .35·80 + .15·60 + .15·70 + .35·75 = 28 + 9 + 10.5 + 26.25 = 73.75
    expect(mp.EXT).toBe(74);
    // DFC = .10·80 + .15·70 + .45·40 + .30·65 = 8 + 10.5 + 18 + 19.5 = 56
    expect(mp.DFC).toBe(56);
    // DC = .20·80 + .45·60 + .15·75 + .20·65 = 16 + 27 + 11.25 + 13 = 67.25
    expect(mp.DC).toBe(67);
  });

  it('sin atributos de portero no hay media de portero', () => {
    expect(positionAverages(OUTFIELD).POR).toBeUndefined();
    // POR = .20·70 + .20·60 + .25·80 + .20·65 + .10·50 + .05·70 = 14+12+20+13+5+3.5 = 67.5
    expect(positionAverages({ ...OUTFIELD, ...GOALKEEPER }).POR).toBe(68);
  });

  it('todo 99 da 99 y todo 0 da 0 en cada posición', () => {
    const all = (v: number) =>
      Object.fromEntries(Object.keys({ ...OUTFIELD, ...GOALKEEPER }).map((k) => [k, v]));
    expect(new Set(Object.values(positionAverages(all(99))))).toEqual(new Set([99]));
    expect(new Set(Object.values(positionAverages(all(0))))).toEqual(new Set([0]));
  });
});

describe('assertValidRating', () => {
  it('acepta los 6 de campo, con o sin los 6 de portero', () => {
    expect(() => assertValidRating(OUTFIELD)).not.toThrow();
    expect(() => assertValidRating({ ...OUTFIELD, ...GOALKEEPER })).not.toThrow();
  });

  it('rechaza faltantes, portero a medias y valores fuera de 0–99', () => {
    const { PHY: _, ...missing } = OUTFIELD;
    expect(() => assertValidRating(missing)).toThrow(InvalidRatingError);
    expect(() => assertValidRating({ ...OUTFIELD, GK_DIV: 50 })).toThrow(/todos o ninguno/);
    expect(() => assertValidRating({ ...OUTFIELD, PAC: 100 })).toThrow(/0 a 99/);
    expect(() => assertValidRating({ ...OUTFIELD, PAC: 70.5 })).toThrow(/0 a 99/);
  });
});

describe('anclas', () => {
  it('ubica cada valor en su rango', () => {
    expect(anchorFor(99).label).toMatch(/Referencia/);
    expect(anchorFor(70).label).toMatch(/Destaca/);
    expect(anchorFor(69).label).toMatch(/medio/);
    expect(anchorFor(40).label).toMatch(/Por debajo/);
    expect(anchorFor(0).label).toMatch(/Carencia/);
  });
});
