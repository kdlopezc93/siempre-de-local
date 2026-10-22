import type { MatchFormat, PositionCode, SquadPlayer } from '@sdl/contracts';
import { ELIGIBLE_POSITIONS, F8_FOLD } from '@sdl/domain';

/** De dónde sale la posición de cada jugador al armar el reparto. */
export type DistributionSource = 'staff' | 'test' | 'preferred';

/** La posición de un jugador según la fuente, o null si esa fuente no la tiene (o no se ve). */
export function positionOf(player: SquadPlayer, source: DistributionSource): PositionCode | null {
  if (source === 'staff') return player.latestAssessment?.primaryPosition ?? null;
  if (source === 'test') return player.test.status === 'visible' ? player.test.podium[0]! : null;
  return player.preferredPositions[0] ?? null;
}

/**
 * Quién juega en cada posición del formato, según la fuente. En F8 el pivote cuenta como
 * mediocentro y la mediapunta como delantero (02 §4). `unknown`: sin dato en esa fuente.
 */
export function distribution(
  players: readonly SquadPlayer[],
  source: DistributionSource,
  format: MatchFormat,
): { roster: Record<PositionCode, string[]>; gaps: PositionCode[]; unknown: number } {
  const eligible = ELIGIBLE_POSITIONS[format];
  const roster = Object.fromEntries(eligible.map((pos) => [pos, [] as string[]])) as Record<
    PositionCode,
    string[]
  >;
  let unknown = 0;
  for (const player of players) {
    const raw = positionOf(player, source);
    if (!raw) {
      unknown++;
      continue;
    }
    const pos = format === 'F8' ? (F8_FOLD[raw] ?? raw) : raw;
    roster[pos].push(player.displayName);
  }
  return { roster, gaps: eligible.filter((pos) => roster[pos].length === 0), unknown };
}
