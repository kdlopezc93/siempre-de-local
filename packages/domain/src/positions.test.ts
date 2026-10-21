import { describe, expect, it } from 'vitest';

import { ELIGIBLE_POSITIONS, POSITION_CODES, isPositionCode } from './positions.js';

describe('positions', () => {
  it('mantiene el orden canónico de 02 §1', () => {
    expect(POSITION_CODES).toEqual(['POR', 'LAT', 'DFC', 'MCD', 'MC', 'MP', 'EXT', 'DC']);
  });

  it('reconoce solo códigos válidos', () => {
    expect(isPositionCode('DFC')).toBe(true);
    expect(isPositionCode('CB')).toBe(false);
  });

  it('en F8 compiten 6 posiciones: sin pivote ni mediapunta', () => {
    expect(ELIGIBLE_POSITIONS.F8).toEqual(['POR', 'LAT', 'DFC', 'MC', 'EXT', 'DC']);
    expect(ELIGIBLE_POSITIONS.F11).toEqual(POSITION_CODES);
  });
});
