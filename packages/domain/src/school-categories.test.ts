import { describe, expect, it } from 'vitest';

import { categoryConflict, formatBirthYears, yearsOverlap } from './school-categories.js';

const sub12 = { category: 'Sub-12', years: { from: 2014, to: 2015 } };
const sub10 = { category: 'Sub-10', years: { from: 2016, to: 2017 } };
const mayores = { category: 'Mayores', years: { from: null, to: 2008 } };

describe('categorías de una escuela', () => {
  it('un grupo más de la misma categoría, con sus mismos años, no choca', () => {
    expect(categoryConflict([sub12, sub10], { category: 'sub-12', years: sub12.years })).toBeNull();
  });

  it('una categoría nueva en años libres no choca', () => {
    expect(
      categoryConflict([sub12, sub10], { category: 'Sub-8', years: { from: 2018, to: 2019 } }),
    ).toBeNull();
  });

  it('años que se cruzan con otra categoría', () => {
    expect(
      categoryConflict([sub12, sub10], { category: 'Sub-11', years: { from: 2015, to: 2016 } }),
    ).toEqual({ kind: 'overlap', with: sub12 });
  });

  it('la misma categoría con otros años', () => {
    expect(
      categoryConflict([sub12], { category: 'Sub-12', years: { from: 2014, to: 2014 } }),
    ).toEqual({ kind: 'years-mismatch', with: sub12 });
  });

  it('los mismos años con otro nombre son la misma categoría', () => {
    expect(categoryConflict([sub12], { category: 'Infantil', years: sub12.years })).toEqual({
      kind: 'name-mismatch',
      with: sub12,
    });
  });

  it('una categoría abierta por abajo (18+) se cruza con todo lo de antes', () => {
    expect(yearsOverlap(mayores.years, { from: 2000, to: 2001 })).toBe(true);
    expect(yearsOverlap(mayores.years, { from: 2009, to: 2010 })).toBe(false);
    expect(
      categoryConflict([mayores], { category: 'Sub-20', years: { from: 2007, to: 2009 } }),
    ).toEqual({ kind: 'overlap', with: mayores });
  });

  it('los años para los mensajes', () => {
    expect(formatBirthYears(sub12.years)).toBe('2014–2015');
    expect(formatBirthYears({ from: 2016, to: 2016 })).toBe('2016');
    expect(formatBirthYears(mayores.years)).toBe('2008 o antes');
  });
});
