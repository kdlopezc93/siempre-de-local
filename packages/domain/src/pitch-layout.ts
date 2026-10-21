import type { MatchFormat, PositionCode } from './positions.js';

/**
 * Coordenadas de cada posición en la pizarra (viewBox 100×150, portería propia abajo).
 * Fuente única (02 §1): el prototipo tenía otra copia con valores distintos en el panel.
 */
export const PITCH_LAYOUT: Readonly<
  Record<MatchFormat, Readonly<Partial<Record<PositionCode, readonly [x: number, y: number]>>>>
> = {
  F11: {
    POR: [50, 139],
    LAT: [20, 113],
    DFC: [50, 116],
    MCD: [50, 97],
    MC: [64, 80],
    MP: [36, 60],
    EXT: [80, 64],
    DC: [50, 36],
  },
  F8: {
    POR: [50, 139],
    LAT: [26, 113],
    DFC: [60, 115],
    MC: [42, 86],
    EXT: [73, 72],
    DC: [50, 42],
  },
};
