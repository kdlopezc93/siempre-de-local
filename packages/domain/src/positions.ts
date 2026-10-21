/** Orden canónico de las posiciones (docs/02-dominio-y-reglas.md §1). */
export const POSITION_CODES = ['POR', 'LAT', 'DFC', 'MCD', 'MC', 'MP', 'EXT', 'DC'] as const;

export type PositionCode = (typeof POSITION_CODES)[number];

export type MatchFormat = 'F8' | 'F11';

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

/** En F8 no hay pivote ni mediapunta: sus puntos se pliegan en MC y DC (02 §4). */
export const F8_FOLD: Readonly<Partial<Record<PositionCode, PositionCode>>> = {
  MCD: 'MC',
  MP: 'DC',
};

/** Posiciones que compiten en cada formato, en orden canónico. */
export const ELIGIBLE_POSITIONS: Readonly<Record<MatchFormat, readonly PositionCode[]>> = {
  F11: POSITION_CODES,
  F8: POSITION_CODES.filter((code) => !(code in F8_FOLD)),
};
