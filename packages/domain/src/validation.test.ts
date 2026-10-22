import { describe, expect, it } from 'vitest';

import { spearman, strengthOf, testVsStaff } from './validation.js';

describe('test vs. cuerpo técnico (02 §11)', () => {
  it('coincidencia exacta, dentro del podio y en qué se equivoca', () => {
    const r = testVsStaff([
      { staff: 'DFC', podium: ['DFC', 'MCD', 'LAT'] },
      { staff: 'DFC', podium: ['MCD', 'DFC', 'LAT'] },
      { staff: 'EXT', podium: ['DC', 'MP', 'MC'] },
      { staff: 'DFC', podium: ['MCD', 'LAT', 'POR'] },
      { staff: 'MC', podium: [] },
    ]);
    expect(r).toMatchObject({ n: 4, exact: 1, inPodium: 2 });
    expect(r.confusion).toEqual([
      { staff: 'DFC', test: 'MCD', count: 2 },
      { staff: 'DFC', test: 'DFC', count: 1 },
      { staff: 'EXT', test: 'DC', count: 1 },
    ]);
  });
});

describe('Spearman', () => {
  it('1 si suben juntas, -1 si una sube y la otra baja, con empates promediados', () => {
    expect(spearman([1, 2, 3, 4, 5], [10, 20, 30, 40, 50])).toBeCloseTo(1, 10);
    expect(spearman([1, 2, 3, 4, 5], [5, 4, 3, 2, 1])).toBeCloseTo(-1, 10);
    // Monótona aunque no lineal: igual 1.
    expect(spearman([1, 2, 3, 4, 5], [1, 4, 9, 16, 100])).toBeCloseTo(1, 10);
    // Con empates: rangos promedio.
    expect(spearman([1, 2, 2, 3], [1, 2, 3, 4])).toBeCloseTo(0.9487, 4);
  });

  it('sin datos suficientes o sin variación, null', () => {
    expect(spearman([1, 2], [1, 2])).toBeNull();
    expect(spearman([3, 3, 3], [1, 2, 3])).toBeNull();
  });

  it('en palabras', () => {
    expect([0.7, -0.5, 0.25, 0.1].map(strengthOf)).toEqual(['strong', 'moderate', 'weak', 'none']);
  });
});
