import type {
  MatchRatingsResponse,
  MatchRatingValue,
  MatchRoster,
  PublishedLineupResponse,
} from '@sdl/contracts';
import { MATCH_RATING_LABELS } from '@sdl/domain';

/** Las cinco palabras de la evaluación, de menos a más (D18). */
export const RATING_OPTIONS = ([1, 2, 3, 4, 5] as const).map((value) => ({
  value,
  label: MATCH_RATING_LABELS[value],
}));

export const ratingLabel = (rating: MatchRatingValue) =>
  MATCH_RATING_LABELS[rating as keyof typeof MATCH_RATING_LABELS];

export interface RatablePlayer {
  playerId: string;
  displayName: string;
  jerseyNumber: number | null;
  /** Si quien mira puede evaluarlo (04 §2.2); si no, la fila solo muestra cómo le fue. */
  canRate: boolean;
}

const byJerseyThenName = (a: RatablePlayer, b: RatablePlayer) =>
  (a.jerseyNumber ?? 1000) - (b.jerseyNumber ?? 1000) ||
  a.displayName.localeCompare(b.displayName, 'es');

/**
 * A quién evaluar: los que jugaron según la alineación publicada (titulares y banco); sin
 * alineación, los que dijeron "voy". Los ya evaluados siempre están (aunque hayan salido del
 * equipo). El resto de la plantilla queda para "Agregar a otro que jugó".
 */
export function whoPlayed(input: {
  roster: MatchRoster;
  lineup: PublishedLineupResponse | null;
  ratings: MatchRatingsResponse['items'];
  added: ReadonlySet<string>;
}): { played: RatablePlayer[]; others: RatablePlayer[] } {
  const { roster, lineup, ratings, added } = input;
  const inLineup = lineup
    ? new Set(
        [...lineup.starters.map((s) => s.player?.id), ...lineup.bench.map((p) => p.id)].filter(
          (id): id is string => Boolean(id),
        ),
      )
    : new Set(roster.filter((p) => p.reply === 'yes').map((p) => p.playerId));
  const rated = new Set(ratings.map((r) => r.playerId));
  const played: RatablePlayer[] = [];
  const others: RatablePlayer[] = [];
  for (const p of roster) {
    const entry = {
      playerId: p.playerId,
      displayName: p.displayName,
      jerseyNumber: p.jerseyNumber,
      canRate: p.canRate,
    };
    if (inLineup.has(p.playerId) || rated.has(p.playerId) || added.has(p.playerId)) {
      played.push(entry);
    } else {
      others.push(entry);
    }
  }
  const inRoster = new Set(roster.map((p) => p.playerId));
  for (const r of ratings) {
    if (!inRoster.has(r.playerId)) {
      played.push({
        playerId: r.playerId,
        displayName: r.displayName,
        jerseyNumber: r.jerseyNumber,
        // Ya no está en el equipo: el API igual decide si se le puede quitar.
        canRate: true,
      });
    }
  }
  return { played: played.sort(byJerseyThenName), others };
}
