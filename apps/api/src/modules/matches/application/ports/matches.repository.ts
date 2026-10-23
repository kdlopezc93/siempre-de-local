import type { MatchFormat, MatchRatingValue, MatchReply, MatchStatus } from '@sdl/contracts';

export interface MatchRecord {
  id: string;
  teamId: string;
  format: MatchFormat;
  startsAt: Date;
  place: string;
  opponent: string;
  status: MatchStatus;
  createdBy: { id: string; name: string } | null;
  lineupId: string | null;
  publishedAt: Date | null;
  /** Después del partido (D18). */
  goalsFor: number | null;
  goalsAgainst: number | null;
  figure: { id: string; name: string } | null;
  resultAt: Date | null;
}

export interface MatchResultData {
  goalsFor: number;
  goalsAgainst: number;
  figurePlayerId: string | null;
  resultAt: Date;
}

export interface MatchRatingRecord {
  playerId: string;
  playerName: string;
  rating: MatchRatingValue;
  note: string | null;
  ratedBy: { id: string; name: string } | null;
  ratedAt: Date;
}

export interface PlayerMatchRatingRecord {
  matchId: string;
  opponent: string;
  startsAt: Date;
  rating: MatchRatingValue;
  note: string | null;
}

export interface MatchesRepository {
  create(
    teamId: string,
    createdBy: string,
    data: Pick<MatchRecord, 'format' | 'startsAt' | 'place' | 'opponent'>,
  ): Promise<string>;
  find(teamId: string, matchId: string): Promise<MatchRecord | null>;
  listByTeam(teamId: string): Promise<MatchRecord[]>;
  update(
    matchId: string,
    patch: Partial<Pick<MatchRecord, 'format' | 'startsAt' | 'place' | 'opponent' | 'status'>>,
  ): Promise<void>;
  /** Respuestas por partido: partido → jugador → voy / no voy. */
  replies(matchIds: string[]): Promise<Map<string, Map<string, MatchReply>>>;
  setReply(matchId: string, userId: string, reply: MatchReply): Promise<void>;
  setResult(matchId: string, result: MatchResultData): Promise<void>;
  /** Las evaluaciones del partido, con nota y autor. */
  ratings(matchId: string): Promise<MatchRatingRecord[]>;
  /** La evaluación de un jugador en cada partido: partido → 1 a 5. */
  ratingsOf(matchIds: string[], playerId: string): Promise<Map<string, MatchRatingValue>>;
  setRating(
    matchId: string,
    playerId: string,
    data: { rating: MatchRatingValue; note: string | null; ratedBy: string },
  ): Promise<void>;
  deleteRating(matchId: string, playerId: string): Promise<void>;
  /** Cómo le fue a un jugador en los partidos del equipo, del más reciente al más antiguo. */
  playerRatings(teamId: string, playerId: string): Promise<PlayerMatchRatingRecord[]>;
}

export const MATCHES_REPOSITORY = Symbol('MATCHES_REPOSITORY');
