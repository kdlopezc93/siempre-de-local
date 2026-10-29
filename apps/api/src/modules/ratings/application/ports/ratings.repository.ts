import type { PositionCode, RatingValues } from '@sdl/domain';

export interface StoredRating {
  id: string;
  playerId: string;
  ratedBy: { id: string; name: string } | null;
  ratedAt: Date;
  source: 'manual' | 'field_test';
  notes: string | null;
  position: PositionCode | null;
  values: RatingValues;
}

export interface NewRating {
  teamId: string;
  playerUserId: string;
  ratedBy: string;
  values: RatingValues;
  notes: string | null;
  position: PositionCode | null;
}

export interface RatingsRepository {
  create(input: NewRating): Promise<StoredRating>;
  /** De la más reciente a la más antigua. */
  listByPlayer(teamId: string, playerUserId: string): Promise<StoredRating[]>;
  /** La foto más reciente de cada jugador del equipo (también la lee squad). */
  latestByTeam(teamId: string): Promise<Map<string, StoredRating>>;
}

export const RATINGS_REPOSITORY = Symbol('RATINGS_REPOSITORY');
