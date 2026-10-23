import type { MatchFormat, MatchStatus } from '@sdl/contracts';

/**
 * Lo que alineaciones necesita de los partidos (lo implementa el módulo matches): ver el
 * partido al ligar una alineación y marcarla publicada. Partidos no conoce a alineaciones.
 */
export interface MatchGateway {
  find(
    teamId: string,
    matchId: string,
  ): Promise<{
    format: MatchFormat;
    opponent: string;
    status: MatchStatus;
    startsAt: Date;
    lineupId: string | null;
    publishedAt: Date | null;
  } | null>;
  publish(matchId: string, lineupId: string, at: Date): Promise<void>;
}

export const MATCH_GATEWAY = Symbol('MATCH_GATEWAY');
