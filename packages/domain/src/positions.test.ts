import { describe, expect, it } from 'vitest';

import {
  ELIGIBLE_POSITIONS,
  foldPosition,
  POSITION_CODES,
  isPositionCode,
  positionName,
} from './positions.js';

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

  it('en F5 compiten portero, cierre, ala y pívot, con sus nombres de micro (2026-10-29)', () => {
    expect(ELIGIBLE_POSITIONS.F5).toEqual(['POR', 'DFC', 'EXT', 'DC']);
    expect(['LAT', 'MCD', 'MC', 'MP'].map((p) => foldPosition(p as never, 'F5'))).toEqual([
      'DFC',
      'DFC',
      'EXT',
      'DC',
    ]);
    expect(foldPosition('MCD', 'F8')).toBe('MC');
    expect(foldPosition('MCD', 'F11')).toBe('MCD');
    expect(['POR', 'DFC', 'EXT', 'DC'].map((p) => positionName(p as never, 'F5'))).toEqual([
      'Portero',
      'Cierre',
      'Ala',
      'Pívot',
    ]);
    expect(positionName('DFC', 'F8')).toBe('Defensa central');
    expect(positionName('EXT')).toBe('Extremo');
  });
});
