import type { MatchFormat, PositionCode, SquadPlayer } from '@sdl/contracts';
import { ELIGIBLE_POSITIONS, F8_FOLD } from '@sdl/domain';

/** De dónde sale la posición de cada jugador al contar el reparto. */
export type DistributionSource = 'staff' | 'test' | 'preferred';

/** La posición de un jugador según la fuente, o null si esa fuente no la tiene (o no se ve). */
export function positionOf(player: SquadPlayer, source: DistributionSource): PositionCode | null {
  if (source === 'staff') return player.latestAssessment?.primaryPosition ?? null;
  if (source === 'test') return player.test.status === 'visible' ? player.test.podium[0]! : null;
  return player.preferredPositions[0] ?? null;
}

/**
 * Cuántos jugadores hay en cada posición del formato. En F8 el pivote cuenta como
 * mediocentro y la mediapunta como delantero (02 §4). `unknown`: sin dato en esa fuente.
 */
export function distribution(
  players: readonly SquadPlayer[],
  source: DistributionSource,
  format: MatchFormat,
): { counts: Record<PositionCode, number>; gaps: PositionCode[]; unknown: number } {
  const eligible = ELIGIBLE_POSITIONS[format];
  const counts = Object.fromEntries(eligible.map((pos) => [pos, 0])) as Record<
    PositionCode,
    number
  >;
  let unknown = 0;
  for (const player of players) {
    const raw = positionOf(player, source);
    if (!raw) {
      unknown++;
      continue;
    }
    const pos = format === 'F8' ? (F8_FOLD[raw] ?? raw) : raw;
    counts[pos] = (counts[pos] ?? 0) + 1;
  }
  return { counts, gaps: eligible.filter((pos) => counts[pos] === 0), unknown };
}
