/** Orden canónico de las posiciones (docs/02-dominio-y-reglas.md §1). */
export const POSITION_CODES = ['POR', 'LAT', 'DFC', 'MCD', 'MC', 'MP', 'EXT', 'DC'] as const;

export type PositionCode = (typeof POSITION_CODES)[number];

export type MatchFormat = 'F5' | 'F8' | 'F11';

export function isPositionCode(value: string): value is PositionCode {
  return (POSITION_CODES as readonly string[]).includes(value);
}

export const POSITIONS: Readonly<Record<PositionCode, { name: string; number: number }>> = {
  POR: { name: 'Portero', number: 1 },
  LAT: { name: 'Lateral', number: 2 },
  DFC: { name: 'Defensa central', number: 4 },
  MCD: { name: 'Pivote', number: 6 },
  MC: { name: 'Mediocentro', number: 8 },
  MP: { name: 'Mediapunta', number: 10 },
  EXT: { name: 'Extremo', number: 7 },
  DC: { name: 'Delantero centro', number: 9 },
};

type Fold = Readonly<Partial<Record<PositionCode, PositionCode>>>;

/** En F8 no hay pivote ni mediapunta: sus puntos se pliegan en MC y DC (02 §4). */
export const F8_FOLD: Fold = {
  MCD: 'MC',
  MP: 'DC',
};

/**
 * En F5 (Kevin, 2026-10-29) se juega con portero, cierre, alas y pívot, como en micro: lateral y
 * pivote se pliegan en el cierre (DFC), mediocentro en el ala (EXT) y mediapunta en el pívot (DC).
 */
export const F5_FOLD: Fold = {
  LAT: 'DFC',
  MCD: 'DFC',
  MC: 'EXT',
  MP: 'DC',
};

/** Qué posición se pliega en cuál en cada formato; en F11 están todas. */
export const FORMAT_FOLD: Readonly<Record<MatchFormat, Fold>> = {
  F11: {},
  F8: F8_FOLD,
  F5: F5_FOLD,
};

/** La posición en la que cuenta `pos` en ese formato (ella misma si no se pliega). */
export function foldPosition(pos: PositionCode, format: MatchFormat): PositionCode {
  return FORMAT_FOLD[format][pos] ?? pos;
}

/** Posiciones que compiten en cada formato, en orden canónico. */
export const ELIGIBLE_POSITIONS: Readonly<Record<MatchFormat, readonly PositionCode[]>> = {
  F11: POSITION_CODES,
  F8: POSITION_CODES.filter((code) => !(code in F8_FOLD)),
  F5: POSITION_CODES.filter((code) => !(code in F5_FOLD)),
};

/** En F5 se dicen como en micro (Kevin, 2026-10-29); en F8 y F11, como siempre. */
const F5_NAMES: Readonly<Partial<Record<PositionCode, string>>> = {
  DFC: 'Cierre',
  EXT: 'Ala',
  DC: 'Pívot',
};

/** El nombre de la posición en ese formato. */
export function positionName(pos: PositionCode, format?: MatchFormat): string {
  return (format === 'F5' && F5_NAMES[pos]) || POSITIONS[pos].name;
}
