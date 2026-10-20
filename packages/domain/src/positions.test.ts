import { describe, expect, it } from 'vitest';

import { POSITION_CODES, isPositionCode } from './positions.js';

describe('positions', () => {
  it('mantiene el orden canónico de 02 §1', () => {
    expect(POSITION_CODES).toEqual(['POR', 'LAT', 'DFC', 'MCD', 'MC', 'MP', 'EXT', 'DC']);
  });

  it('reconoce solo códigos válidos', () => {
    expect(isPositionCode('DFC')).toBe(true);
    expect(isPositionCode('CB')).toBe(false);
  });
});
