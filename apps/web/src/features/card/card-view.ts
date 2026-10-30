import type { MatchFormat, PositionCode } from '@sdl/contracts';
import { ELIGIBLE_POSITIONS, foldPosition } from '@sdl/domain';

export interface PositionAverage {
  pos: PositionCode;
  value: number;
}

/** Medias de las posiciones del formato, de la más alta a la más baja (empate: orden canónico). */
export function rankedAverages(
  averages: Partial<Record<PositionCode, number>>,
  format: MatchFormat,
): PositionAverage[] {
  return ELIGIBLE_POSITIONS[format]
    .filter((pos) => averages[pos] !== undefined)
    .map((pos) => ({ pos, value: averages[pos]! }))
    .sort((a, b) => b.value - a.value);
}

/** La posición de la tarjeta en el formato: en F8 y F5 algunas se pliegan (02 §4). */
export function cardPositionIn(position: PositionCode, format: MatchFormat): PositionCode {
  return foldPosition(position, format);
}

/**
 * Lo que encabeza la tarjeta (02 §7.4): la posición que le puso quien puntuó, con su media; si
 * no tiene (las fotos de antes), su mejor media. `best` es la mejor media cuando no es esa.
 */
export function cardHeadline(
  card: { position: PositionCode | null; positionAverages: Partial<Record<PositionCode, number>> },
  format: MatchFormat,
): { main: PositionAverage; chosen: boolean; best: PositionAverage | null } | null {
  const ranked = rankedAverages(card.positionAverages, format);
  const top = ranked[0];
  if (!top) return null;
  const pos = card.position && cardPositionIn(card.position, format);
  const value = pos ? card.positionAverages[pos] : undefined;
  if (!pos || value === undefined) return { main: top, chosen: false, best: null };
  return { main: { pos, value }, chosen: true, best: top.value > value ? top : null };
}

export const RATED_ON = new Intl.DateTimeFormat('es-419', {
  day: 'numeric',
  month: 'short',
  year: 'numeric',
});
