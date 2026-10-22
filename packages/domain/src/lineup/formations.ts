import type { MatchFormat, PositionCode } from '../positions.js';

/** Un puesto de una formación: qué posición pide, de qué lado y dónde va en la pizarra. */
export interface FormationSlot {
  /** Único dentro de la formación, p. ej. `DFC-2`. */
  id: string;
  position: PositionCode;
  side?: 'izquierda' | 'derecha';
  /** viewBox 100×150, portería propia abajo (igual que PITCH_LAYOUT). */
  coord: readonly [x: number, y: number];
}

export interface Formation {
  key: string;
  label: string;
  format: MatchFormat;
  slots: readonly FormationSlot[];
}

type Raw = [PositionCode, readonly [number, number], ('izquierda' | 'derecha')?];

/** Numera los puestos repetidos (DFC-1, DFC-2) para que cada uno tenga su id. */
function formation(key: string, label: string, format: MatchFormat, raw: Raw[]): Formation {
  const seen = new Map<PositionCode, number>();
  const total = (p: PositionCode) => raw.filter(([q]) => q === p).length;
  return {
    key,
    label,
    format,
    slots: raw.map(([position, coord, side]) => {
      const n = (seen.get(position) ?? 0) + 1;
      seen.set(position, n);
      return {
        id: total(position) > 1 ? `${position}-${n}` : position,
        position,
        ...(side ? { side } : {}),
        coord,
      };
    }),
  };
}

/**
 * F8: las 4 formaciones del planificador del prototipo (D6), con sus coordenadas.
 * F11: las cuatro más usadas en el fútbol amateur (decidido el 2026-10-22).
 */
export const FORMATIONS: readonly Formation[] = [
  formation('1-3-3-1', '1-3-3-1', 'F8', [
    ['POR', [50, 139]],
    ['LAT', [16, 112], 'izquierda'],
    ['DFC', [50, 116]],
    ['LAT', [84, 112], 'derecha'],
    ['EXT', [20, 72], 'izquierda'],
    ['MC', [50, 78]],
    ['EXT', [80, 72], 'derecha'],
    ['DC', [50, 32]],
  ]),
  formation('1-2-4-1', '1-2-4-1', 'F8', [
    ['POR', [50, 139]],
    ['DFC', [35, 118]],
    ['DFC', [65, 118]],
    ['EXT', [14, 84], 'izquierda'],
    ['MC', [38, 90]],
    ['MC', [62, 90]],
    ['EXT', [86, 84], 'derecha'],
    ['DC', [50, 32]],
  ]),
  formation('1-3-4', '1-3-4 (sin delantero)', 'F8', [
    ['POR', [50, 139]],
    ['LAT', [16, 116], 'izquierda'],
    ['DFC', [50, 120]],
    ['LAT', [84, 116], 'derecha'],
    ['EXT', [14, 66], 'izquierda'],
    ['MC', [38, 72]],
    ['MC', [62, 72]],
    ['EXT', [86, 66], 'derecha'],
  ]),
  formation('1-2-3-2', '1-2-3-2', 'F8', [
    ['POR', [50, 139]],
    ['DFC', [35, 118]],
    ['DFC', [65, 118]],
    ['MC', [50, 96]],
    ['MC', [30, 80]],
    ['MC', [70, 80]],
    ['DC', [38, 34]],
    ['DC', [62, 34]],
  ]),
  formation('1-4-3-3', '1-4-3-3', 'F11', [
    ['POR', [50, 139]],
    ['LAT', [14, 112], 'izquierda'],
    ['DFC', [37, 118]],
    ['DFC', [63, 118]],
    ['LAT', [86, 112], 'derecha'],
    ['MCD', [50, 96]],
    ['MC', [30, 80]],
    ['MC', [70, 80]],
    ['EXT', [16, 44], 'izquierda'],
    ['DC', [50, 32]],
    ['EXT', [84, 44], 'derecha'],
  ]),
  formation('1-4-4-2', '1-4-4-2', 'F11', [
    ['POR', [50, 139]],
    ['LAT', [14, 112], 'izquierda'],
    ['DFC', [37, 118]],
    ['DFC', [63, 118]],
    ['LAT', [86, 112], 'derecha'],
    ['EXT', [14, 74], 'izquierda'],
    ['MC', [38, 84]],
    ['MC', [62, 84]],
    ['EXT', [86, 74], 'derecha'],
    ['DC', [38, 34]],
    ['DC', [62, 34]],
  ]),
  formation('1-4-2-3-1', '1-4-2-3-1', 'F11', [
    ['POR', [50, 139]],
    ['LAT', [14, 112], 'izquierda'],
    ['DFC', [37, 118]],
    ['DFC', [63, 118]],
    ['LAT', [86, 112], 'derecha'],
    ['MCD', [38, 94]],
    ['MCD', [62, 94]],
    ['EXT', [16, 58], 'izquierda'],
    ['MP', [50, 62]],
    ['EXT', [84, 58], 'derecha'],
    ['DC', [50, 30]],
  ]),
  formation('1-3-5-2', '1-3-5-2', 'F11', [
    ['POR', [50, 139]],
    ['DFC', [28, 118]],
    ['DFC', [50, 122]],
    ['DFC', [72, 118]],
    ['LAT', [10, 84], 'izquierda'],
    ['MCD', [50, 96]],
    ['MC', [32, 76]],
    ['MC', [68, 76]],
    ['LAT', [90, 84], 'derecha'],
    ['DC', [38, 34]],
    ['DC', [62, 34]],
  ]),
];

export const DEFAULT_FORMATION: Readonly<Record<MatchFormat, string>> = {
  F8: '1-3-3-1',
  F11: '1-4-3-3',
};

export function formationsFor(format: MatchFormat): Formation[] {
  return FORMATIONS.filter((f) => f.format === format);
}

export function findFormation(key: string): Formation | undefined {
  return FORMATIONS.find((f) => f.key === key);
}

/** Línea de cada posición, para priorizar una al armar (como el prototipo). */
export const LINE_OF: Readonly<Record<PositionCode, 'defensa' | 'medio' | 'ataque'>> = {
  POR: 'defensa',
  LAT: 'defensa',
  DFC: 'defensa',
  MCD: 'medio',
  MC: 'medio',
  MP: 'medio',
  EXT: 'ataque',
  DC: 'ataque',
};
