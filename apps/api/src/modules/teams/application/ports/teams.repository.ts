import type { MatchFormat } from '@sdl/contracts';

export interface TeamRecord {
  id: string;
  name: string;
  format: MatchFormat;
  formats: MatchFormat[];
  season: string;
  club: { id: string; name: string };
  ratingsVisibleToPlayers: boolean;
  matchRatingsVisibleToPlayers: boolean;
}

/** Lo que se cambia desde Datos del equipo y los ajustes de visibilidad (D8, D14, D18). */
export type TeamSettings = Partial<
  Pick<
    TeamRecord,
    'ratingsVisibleToPlayers' | 'matchRatingsVisibleToPlayers' | 'name' | 'format' | 'formats'
  >
>;

export interface TeamsRepository {
  findById(teamId: string): Promise<TeamRecord | null>;
  /** Solo lo que cambia; `name-taken` si el club ya tiene otro equipo con ese nombre esta temporada. */
  updateSettings(teamId: string, settings: TeamSettings): Promise<'ok' | 'name-taken'>;
  /** Cambia el dorsal del jugador activo; false si no es jugador activo del equipo. */
  setJerseyNumber(teamId: string, userId: string, jerseyNumber: number | null): Promise<boolean>;
  /** Marca (o desmarca, con null) al jugador activo como lesionado; false si no es jugador. */
  setInjury(
    teamId: string,
    userId: string,
    injury: { injuredAt: Date; returnOn: string | null } | null,
  ): Promise<boolean>;
}

export const TEAMS_REPOSITORY = Symbol('TEAMS_REPOSITORY');
