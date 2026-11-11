import { describe, expect, it } from 'vitest';

import {
  categoryAges,
  childWord,
  agesHint,
  categoryConflict,
  formatBirthYears,
  groupByCategory,
  groupLabel,
  groupTeamName,
  suggestCategoryName,
  suggestGroupName,
  yearsOverlap,
  yearStrip,
} from './school-categories.js';

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

describe('grupos de una categoría', () => {
  it('sugiere el nombre del grupo', () => {
    expect(suggestGroupName('male', 0)).toBe('Masculino');
    expect(suggestGroupName('male', 1)).toBe('Masculino B');
    expect(suggestGroupName('female', 2)).toBe('Femenino C');
    expect(suggestGroupName('mixed', 0)).toBe('');
    expect(suggestGroupName('mixed', 1)).toBe('Mixto B');
  });

  it('arma el nombre completo y lo vuelve a partir', () => {
    expect(groupTeamName('Sub-12', 'Masculino B')).toBe('Sub-12 masculino B');
    expect(groupTeamName('Sub-10', '')).toBe('Sub-10');
    expect(groupLabel('Sub-12 masculino B', 'Sub-12', 'male')).toBe('Masculino B');
    expect(groupLabel('Sub-10', 'Sub-10', 'mixed')).toBe('Mixto');
    expect(groupLabel('Los pequeños', 'Sub-6', 'mixed')).toBe('Los pequeños');
  });

  it('dice qué edad tienen este año', () => {
    expect(agesHint({ from: 2014, to: 2015 }, 2026)).toBe('Este año tienen 11 y 12 años.');
    expect(agesHint({ from: 2016, to: 2016 }, 2026)).toBe('Este año tienen 10 años.');
    expect(agesHint({ from: null, to: 2008 }, 2026)).toBe('Este año tienen 18 años o más.');
  });

  it('junta los grupos por categoría, de la mayor a la menor', () => {
    const teams = [
      { id: 'a', category: 'Sub-12', birthYears: sub12.years },
      { id: 'b', category: 'Sub-10', birthYears: sub10.years },
      { id: 'c', category: 'sub-12', birthYears: sub12.years },
      { id: 'd', category: null, birthYears: null },
    ];
    const grouped = groupByCategory(teams);
    expect(grouped.map((c) => [c.category, c.groups.map((g) => g.id)])).toEqual([
      ['Sub-12', ['a', 'c']],
      ['Sub-10', ['b']],
    ]);
  });

  it('la franja de años, con los huecos', () => {
    expect(yearStrip([sub10, mayores, sub12])).toEqual([
      { kind: 'category', category: 'Mayores', from: null, to: 2008, span: 1 },
      { kind: 'gap', from: 2009, to: 2013, span: 5 },
      { kind: 'category', category: 'Sub-12', from: 2014, to: 2015, span: 2 },
      { kind: 'category', category: 'Sub-10', from: 2016, to: 2017, span: 2 },
    ]);
  });
});

describe('nombre sugerido de la categoría', () => {
  it('la edad del mayor del grupo, o Mayores', () => {
    expect(suggestCategoryName(2014, 2026)).toBe('Sub-12');
    expect(suggestCategoryName(null, 2026)).toBe('Mayores');
  });
});

describe('categoryAges (2026-11-10)', () => {
  it('dice si en la categoría hay menores, mayores o los dos', () => {
    expect(categoryAges({ from: 2016, to: 2017 }, 2026)).toEqual({ minors: true, adults: false });
    expect(categoryAges({ from: null, to: 2008 }, 2026)).toEqual({ minors: false, adults: true });
    expect(categoryAges({ from: 2007, to: 2009 }, 2026)).toEqual({ minors: true, adults: true });
    expect(categoryAges(null, 2026)).toEqual({ minors: false, adults: true });
  });

  it('el niño según el grupo', () => {
    expect(childWord('female')).toBe('tu hija');
    expect(childWord('male')).toBe('tu hijo');
    expect(childWord('mixed')).toBe('tu hijo o hija');
    expect(childWord(null)).toBe('tu hijo o hija');
  });
});
