/** Orden canónico de las posiciones (docs/02-dominio-y-reglas.md §1). */
export const POSITION_CODES = ['POR', 'LAT', 'DFC', 'MCD', 'MC', 'MP', 'EXT', 'DC'] as const;

export type PositionCode = (typeof POSITION_CODES)[number];

export function isPositionCode(value: string): value is PositionCode {
  return (POSITION_CODES as readonly string[]).includes(value);
}
