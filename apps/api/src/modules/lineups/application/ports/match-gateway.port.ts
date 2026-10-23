import type { MatchFormat, MatchStatus } from '@sdl/contracts';

/**
 * Lo que alineaciones necesita de los partidos (lo implementa el módulo matches): ver el
 * partido al ligar una alineación y marcarla publicada. Partidos no conoce a alineaciones.
 */
export interface MatchGateway {
  find(
    teamId: string,
    matchId: string,
  ): Promise<{ format: MatchFormat; status: MatchStatus; startsAt: Date } | null>;
  publish(matchId: string, lineupId: string, at: Date): Promise<void>;
}

export const MATCH_GATEWAY = Symbol('MATCH_GATEWAY');
