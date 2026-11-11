import { describe, expect, it } from 'vitest';

import { minorYears } from './use-guardian-join';

describe('minorYears (2026-11-10)', () => {
  it('los años de la categoría que todavía son de menores', () => {
    expect(minorYears({ from: 2016, to: 2017 }, 2026)).toEqual([2016, 2017]);
    // 2008 ya cumple 18 en 2026: entra con su cuenta.
    expect(minorYears({ from: 2007, to: 2010 }, 2026)).toEqual([2009, 2010]);
    expect(minorYears({ from: null, to: 2008 }, 2026)).toEqual([]);
    expect(minorYears(null, 2026)).toEqual([]);
  });
});
