import type { PositionCode } from '@sdl/domain';
import type { Profile } from '@sdl/contracts';

/** Jugadores activos del equipo (lo implementa teams). */
export interface TeamPlayersQuery {
  activePlayers(
    teamId: string,
  ): Promise<{ userId: string; name: string; jerseyNumber: number | null }[]>;
}
export const TEAM_PLAYERS_QUERY = Symbol('TEAM_PLAYERS_QUERY');

/** Perfiles de varios usuarios a la vez (lo implementa player-profile). */
export interface ProfilesQuery {
  profilesOf(users: { id: string; name: string }[]): Promise<Map<string, Profile>>;
}
export const PROFILES_QUERY = Symbol('PROFILES_QUERY');

/** Último resultado oficial de cada jugador en el equipo (lo implementa quiz). */
export interface LatestResultsQuery {
  latestByTeam(
    teamId: string,
  ): Promise<Map<string, { attemptId: string; submittedAt: Date; podium: PositionCode[] }>>;
}
export const LATEST_RESULTS_QUERY = Symbol('LATEST_RESULTS_QUERY');
