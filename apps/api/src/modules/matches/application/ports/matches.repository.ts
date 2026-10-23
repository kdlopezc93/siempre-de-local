import type { MatchFormat, MatchReply, MatchStatus } from '@sdl/contracts';

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
}

export const MATCHES_REPOSITORY = Symbol('MATCHES_REPOSITORY');
