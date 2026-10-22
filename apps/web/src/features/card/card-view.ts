import type { MatchFormat, PositionCode } from '@sdl/contracts';
import { ELIGIBLE_POSITIONS } from '@sdl/domain';

/** Medias de las posiciones del formato, de la más alta a la más baja (empate: orden canónico). */
export function rankedAverages(
  averages: Partial<Record<PositionCode, number>>,
  format: MatchFormat,
): { pos: PositionCode; value: number }[] {
  return ELIGIBLE_POSITIONS[format]
    .filter((pos) => averages[pos] !== undefined)
    .map((pos) => ({ pos, value: averages[pos]! }))
    .sort((a, b) => b.value - a.value);
}

export const RATED_ON = new Intl.DateTimeFormat('es-419', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
