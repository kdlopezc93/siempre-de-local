import type { MatchFormat } from '@sdl/contracts';

export interface TeamRecord {
  id: string;
  name: string;
  format: MatchFormat;
  formats: MatchFormat[];
  season: string;
  club: { id: string; name: string };
  photoUrl: string | null;
  ratingsVisibleToPlayers: boolean;
}

export interface TeamsRepository {
  findById(teamId: string): Promise<TeamRecord | null>;
  /** Solo lo que cambia; `name-taken` si el club ya tiene otro equipo con ese nombre esta temporada. */
  updateSettings(
    teamId: string,
    settings: Partial<Pick<TeamRecord, 'ratingsVisibleToPlayers' | 'name' | 'format' | 'formats'>>,
  ): Promise<'ok' | 'name-taken'>;
  photoKey(teamId: string): Promise<string | null>;
  setPhotoKey(teamId: string, photoKey: string | null): Promise<void>;
  /** Cambia el dorsal del jugador activo; false si no es jugador activo del equipo. */
  setJerseyNumber(teamId: string, userId: string, jerseyNumber: number | null): Promise<boolean>;
}

export const TEAMS_REPOSITORY = Symbol('TEAMS_REPOSITORY');
