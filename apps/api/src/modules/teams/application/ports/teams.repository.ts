import type { BirthYears, ClubKind, MatchFormat, Sport, TeamRole } from '@sdl/contracts';

export interface TeamRecord {
  id: string;
  name: string;
  format: MatchFormat;
  formats: MatchFormat[];
  season: string;
  category: string | null;
  /** En una escuela, los años de nacimiento de la categoría (2026-11-07). */
  birthYears: BirthYears | null;
  /** La sede donde entrena, o null. */
  venue: { id: string; name: string } | null;
  club: { id: string; name: string; city: string | null; kind: ClubKind; sport: Sport };
  ratingsVisibleToPlayers: boolean;
  matchRatingsVisibleToPlayers: boolean;
  /** Los colores de los afiches, o null: los de la app. */
  colors: string[] | null;
  /** ¿La app recuerda la convocatoria a los que no han respondido? (2026-11-06) */
  callUpReminders: boolean;
}

/** Lo que se cambia desde Datos del equipo y los ajustes de visibilidad (D8, D14, D18). */
export type TeamSettings = Partial<
  { birthYears: BirthYears; venueId: string | null } & Pick<
    TeamRecord,
    | 'ratingsVisibleToPlayers'
    | 'matchRatingsVisibleToPlayers'
    | 'name'
    | 'category'
    | 'format'
    | 'formats'
    | 'colors'
    | 'callUpReminders'
  >
>;

export interface NewTeam {
  name: string;
  category: string | null;
  format: MatchFormat;
  season: string;
  alsoPlays: boolean;
  birthYears: BirthYears | null;
  venueId: string | null;
}

/** `limit`: el club ya tiene sus equipos activos; `name-taken`: ese nombre ya está esta temporada. */
export type CreateTeamOutcome = { teamId: string } | 'limit' | 'name-taken';

export interface ClubRecord {
  id: string;
  name: string;
  city: string | null;
  kind: ClubKind;
  sport: Sport;
}

/** Una sede de la escuela (2026-11-07). */
export interface VenueRecord {
  id: string;
  clubId: string;
  name: string;
  address: string | null;
}

export interface ClubTeamRecord {
  id: string;
  name: string;
  category: string | null;
  format: MatchFormat;
  season: string;
  archived: boolean;
  birthYears: BirthYears | null;
  venue: { id: string; name: string } | null;
  members: number;
}

export interface ClubPerson {
  userId: string;
  name: string;
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
  /** El dueño y los admins del club: primero el dueño, después por nombre. */
  clubAdmins(clubId: string): Promise<(ClubPerson & { role: 'owner' | 'admin' })[]>;
  /** Integrantes activos de los equipos activos del club que no son dueño ni admin. */
  clubCandidates(clubId: string): Promise<ClubPerson[]>;
  addClubAdmin(clubId: string, userId: string): Promise<void>;
  /** Quita a un admin (nunca al dueño); false si no era admin. */
  removeClubAdmin(clubId: string, userId: string): Promise<boolean>;
  updateClub(clubId: string, patch: Partial<Pick<ClubRecord, 'name' | 'city'>>): Promise<void>;
  /** Las sedes del club por nombre, con cuántas categorías activas entrenan en cada una. */
  clubVenues(clubId: string): Promise<(Omit<VenueRecord, 'clubId'> & { teams: number })[]>;
  findVenue(venueId: string): Promise<VenueRecord | null>;
  /** `name-taken`: el club ya tiene una sede con ese nombre. */
  createVenue(
    clubId: string,
    venue: { name: string; address: string | null },
  ): Promise<{ id: string } | 'name-taken'>;
  updateVenue(
    clubId: string,
    venueId: string,
    patch: Partial<{ name: string; address: string | null }>,
  ): Promise<'ok' | 'name-taken' | 'not-found'>;
  /** Borra la sede; sus categorías quedan sin sede. False si no era del club. */
  deleteVenue(clubId: string, venueId: string): Promise<boolean>;
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
