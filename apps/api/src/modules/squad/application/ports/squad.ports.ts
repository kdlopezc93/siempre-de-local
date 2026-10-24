import type { PositionCode } from '@sdl/domain';
import type { PlayerKnowledge, Profile, SquadPlayer } from '@sdl/contracts';

/** Jugadores activos del equipo (lo implementa teams). */
export interface TeamPlayersQuery {
  activePlayers(teamId: string): Promise<
    {
      userId: string;
      name: string;
      jerseyNumber: number | null;
      /** Lesionado desde (null si no lo está) y vuelta estimada (YYYY-MM-DD). */
      injuredAt: Date | null;
      injuryReturnOn: string | null;
    }[]
  >;
  /** El cuerpo técnico activo: una fila por persona y rol. */
  activeStaff(
    teamId: string,
  ): Promise<{ userId: string; name: string; role: 'coach' | 'assistant' }[]>;
}
export const TEAM_PLAYERS_QUERY = Symbol('TEAM_PLAYERS_QUERY');

/** Perfiles de varios usuarios a la vez (lo implementa player-profile). */
export interface ProfilesQuery {
  profilesOf(users: { id: string; name: string }[]): Promise<Map<string, Profile>>;
}
export const PROFILES_QUERY = Symbol('PROFILES_QUERY');

export interface LatestResult {
  attemptId: string;
  submittedAt: Date;
  podium: PositionCode[];
  /** Afinidad 0–1 de cada posición del formato, de mayor a menor. */
  ranking: { pos: PositionCode; pct: number }[];
}

/** Último resultado oficial de cada jugador en el equipo (lo implementa quiz). */
export interface LatestResultsQuery {
  latestByTeam(teamId: string): Promise<Map<string, LatestResult>>;
}
export const LATEST_RESULTS_QUERY = Symbol('LATEST_RESULTS_QUERY');

/** Conocimiento por posición (lo implementa certification). */
export interface KnowledgeQuery {
  ofPlayer(userId: string, now?: Date): Promise<PlayerKnowledge>;
  summaryOf(userIds: string[], now?: Date): Promise<Map<string, SquadPlayer['knowledge']>>;
}
export const KNOWLEDGE_QUERY = Symbol('KNOWLEDGE_QUERY');
