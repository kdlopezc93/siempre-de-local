import type { MatchFormat, TeamRole } from '@sdl/contracts';

export interface TeamRecord {
  id: string;
  name: string;
  format: MatchFormat;
  formats: MatchFormat[];
  season: string;
  category: string | null;
  club: { id: string; name: string; city: string | null };
  ratingsVisibleToPlayers: boolean;
  matchRatingsVisibleToPlayers: boolean;
}

/** Lo que se cambia desde Datos del equipo y los ajustes de visibilidad (D8, D14, D18). */
export type TeamSettings = Partial<
  Pick<
    TeamRecord,
    | 'ratingsVisibleToPlayers'
    | 'matchRatingsVisibleToPlayers'
    | 'name'
    | 'category'
    | 'format'
    | 'formats'
  >
>;

export interface NewTeam {
  name: string;
  category: string | null;
  format: MatchFormat;
  season: string;
  alsoPlays: boolean;
}

/** `limit`: el club ya tiene sus equipos activos; `name-taken`: ese nombre ya está esta temporada. */
export type CreateTeamOutcome = { teamId: string } | 'limit' | 'name-taken';

export interface ClubRecord {
  id: string;
  name: string;
  city: string | null;
}

export interface ClubTeamRecord {
  id: string;
  name: string;
  category: string | null;
  format: MatchFormat;
  season: string;
  archived: boolean;
  members: number;
}

/** Prender (`active`) o apagar un rol de alguien en el equipo. */
export interface RoleChange {
  userId: string;
  role: TeamRole;
  active: boolean;
}

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
  /** Los roles vigentes de alguien en el equipo (vacío si no está). */
  activeRoles(teamId: string, userId: string): Promise<TeamRole[]>;
  /** Quiénes son entrenador del equipo hoy. */
  activeCoaches(teamId: string): Promise<string[]>;
  /**
   * Aplica los cambios juntos (una transacción). Apagar deja la fila con `left_at` (su
   * historial sigue); prender reactiva la anterior (con su dorsal) o crea una nueva.
   */
  changeRoles(teamId: string, changes: RoleChange[], now: Date): Promise<void>;
  /**
   * Otro equipo del club, con quien lo crea de entrenador (y jugador), en una transacción que
   * bloquea el club: dos equipos a la vez no pasan del límite.
   */
  findClub(clubId: string): Promise<ClubRecord | null>;
  /** Los equipos del club: primero los activos, por nombre. */
  clubTeams(clubId: string): Promise<ClubTeamRecord[]>;
  updateClub(clubId: string, patch: Partial<Pick<ClubRecord, 'name' | 'city'>>): Promise<void>;
  /** Archiva o desarchiva un equipo del club; desarchivar respeta el límite de activos. */
  setArchived(
    clubId: string,
    teamId: string,
    archived: boolean,
    maxActive: number,
    now: Date,
  ): Promise<'ok' | 'limit' | 'not-found'>;
  createTeam(
    clubId: string,
    userId: string,
    team: NewTeam,
    maxActive: number,
    now: Date,
  ): Promise<CreateTeamOutcome>;
}

export const TEAMS_REPOSITORY = Symbol('TEAMS_REPOSITORY');
