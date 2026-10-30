import type {
  MatchFormat,
  MatchKind,
  MatchRatingValue,
  MatchReply,
  MatchStatus,
} from '@sdl/contracts';

export interface MatchRecord {
  id: string;
  teamId: string;
  kind: MatchKind;
  /** El torneo, en los de campeonato (null en los de antes hasta asignarlo). */
  tournament: { id: string; name: string } | null;
  format: MatchFormat;
  startsAt: Date;
  place: string;
  /** null en los entrenamientos. */
  opponent: string | null;
  status: MatchStatus;
  createdBy: { id: string; name: string } | null;
  lineupId: string | null;
  publishedAt: Date | null;
  /** Después del partido (D18). */
  goalsFor: number | null;
  goalsAgainst: number | null;
  figure: { id: string; name: string } | null;
  resultAt: Date | null;
  /** "¿Quién vino?" (2026-10-30): desde cuándo hay lista; null = cuentan los que dijeron voy. */
  attendanceTakenAt: Date | null;
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

export interface TournamentRecord {
  id: string;
  name: string;
  createdAt: Date;
}

/** Lo que se guarda al convocar o editar (el torneo, por su id). */
export type MatchData = Pick<MatchRecord, 'kind' | 'format' | 'startsAt' | 'place' | 'opponent'> & {
  tournamentId: string | null;
};

export interface MatchesRepository {
  create(teamId: string, createdBy: string, data: MatchData): Promise<string>;
  find(teamId: string, matchId: string): Promise<MatchRecord | null>;
  listByTeam(teamId: string): Promise<MatchRecord[]>;
  update(matchId: string, patch: Partial<MatchData & Pick<MatchRecord, 'status'>>): Promise<void>;
  /** Respuestas por partido: partido → jugador → voy / no voy. */
  replies(matchIds: string[]): Promise<Map<string, Map<string, MatchReply>>>;
  setReply(matchId: string, userId: string, reply: MatchReply): Promise<void>;
  /** La lista de "¿Quién vino?" (vacía si todavía no la pasaron). */
  attendance(matchId: string): Promise<Set<string>>;
  /** Reemplaza la lista entera y marca el partido con lista. */
  setAttendance(matchId: string, userIds: string[], markedBy: string, at: Date): Promise<void>;
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
  /** Los torneos del equipo, el más nuevo primero (2026-10-28). */
  tournaments(teamId: string): Promise<TournamentRecord[]>;
  findTournament(teamId: string, tournamentId: string): Promise<TournamentRecord | null>;
  /** 'name-taken' si el equipo ya tiene uno con ese nombre (sin importar mayúsculas). */
  createTournament(
    teamId: string,
    createdBy: string,
    name: string,
  ): Promise<TournamentRecord | 'name-taken'>;
}

export const MATCHES_REPOSITORY = Symbol('MATCHES_REPOSITORY');
