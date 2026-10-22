import type { MatchFormat } from '@sdl/contracts';

export interface TeamRecord {
  id: string;
  name: string;
  format: MatchFormat;
  season: string;
  club: { id: string; name: string };
  ratingsVisibleToPlayers: boolean;
}

export interface TeamsRepository {
  findById(teamId: string): Promise<TeamRecord | null>;
  updateSettings(teamId: string, settings: { ratingsVisibleToPlayers: boolean }): Promise<void>;
  /** Cambia el dorsal del jugador activo; false si no es jugador activo del equipo. */
  setJerseyNumber(teamId: string, userId: string, jerseyNumber: number | null): Promise<boolean>;
}

export const TEAMS_REPOSITORY = Symbol('TEAMS_REPOSITORY');
