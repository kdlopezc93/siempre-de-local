/**
 * Política de autorización por equipo (docs/04-auth-seguridad.md §2.2). Función pura:
 * la usan el guard (`@Can`) como primera barrera y los casos de uso como decisión final.
 */

export type ClubRole = 'owner' | 'admin';
export type TeamRole = 'coach' | 'assistant' | 'player';

/** Quién pide, con sus membresías activas. */
export interface Actor {
  userId: string;
  platformAdmin: boolean;
  clubs: ReadonlyMap<string, ClubRole>;
  /** Equipo → roles activos en él (sin `left_at`). */
  teams: ReadonlyMap<string, readonly TeamRole[]>;
}

/** El equipo sobre el que se actúa: el club decide qué pueden hacer sus admins. */
export interface TeamScope {
  teamId: string;
  clubId: string;
}

const STAFF: readonly TeamRole[] = ['coach', 'assistant'];
const MEMBERS: readonly TeamRole[] = ['coach', 'assistant', 'player'];

/**
 * Acciones sobre un equipo y quién puede hacerlas. `clubAdmin` = owner o admin del club
 * dueño del equipo. El admin de plataforma no entra aquí: su acceso de soporte exige
 * registro en `audit_log` y se añade junto con él.
 */
const TEAM_PERMISSIONS = {
  'team.read': { roles: MEMBERS, clubAdmin: true },
  /** El test de orientación es propio del jugador (04 §2.2). */
  'team.quiz.take': { roles: ['player'], clubAdmin: false },
  'team.results.read': { roles: STAFF, clubAdmin: true },
  'team.ratings.write': { roles: STAFF, clubAdmin: false },
  'team.assessments.write': { roles: STAFF, clubAdmin: false },
  'team.lineups.write': { roles: STAFF, clubAdmin: false },
  /** Convocar, editar o cancelar partidos (Fase 7). */
  'team.matches.write': { roles: STAFF, clubAdmin: false },
  /** Marcar o desmarcar lesionados (2026-10-24). */
  'team.injuries.write': { roles: STAFF, clubAdmin: false },
  /** Recordarles el test a los que no lo han hecho (2026-10-26). */
  'team.reminders.send': { roles: STAFF, clubAdmin: false },
  'team.attempts.void': { roles: ['coach'], clubAdmin: true },
  'team.reevaluations.request': { roles: ['coach'], clubAdmin: true },
  'team.players.invite': { roles: ['coach'], clubAdmin: true },
  'team.assistants.invite': { roles: ['coach'], clubAdmin: true },
  'team.staff.invite': { roles: [], clubAdmin: true },
  /** Dorsal, roles de jugador y asistente, pasar el mando y quitar del equipo (04 §2.2). */
  'team.members.manage': { roles: ['coach'], clubAdmin: true },
  'team.data.transfer': { roles: ['coach'], clubAdmin: true },
  /** Ajustes del equipo, p. ej. si el jugador ve su tarjeta (D8). */
  'team.settings.write': { roles: ['coach'], clubAdmin: true },
} as const satisfies Record<string, { roles: readonly TeamRole[]; clubAdmin: boolean }>;

export type TeamPermission = keyof typeof TEAM_PERMISSIONS;

export function can(actor: Actor, permission: TeamPermission, scope: TeamScope): boolean {
  const rule = TEAM_PERMISSIONS[permission];
  const roles = actor.teams.get(scope.teamId) ?? [];
  if (roles.some((role) => (rule.roles as readonly TeamRole[]).includes(role))) return true;
  return rule.clubAdmin && actor.clubs.has(scope.clubId);
}

/** A quién se valora: su id y sus roles activos en el equipo. */
export interface RatingTarget {
  userId: string;
  roles: readonly TeamRole[];
}

/**
 * Quién valora a quién (tarjeta 0–99, valoración del cuerpo técnico y evaluación del partido;
 * 04 §2.2). Nadie se valora a sí mismo; el entrenador valora a todos los demás; el asistente, a
 * todos menos a otros asistentes. Al entrenador que también juega lo valoran los asistentes
 * (2026-10-25: si no, nadie lo valoraba). Quien no es del cuerpo técnico no valora (eso ya lo
 * dice `can`).
 */
export function canRate(actor: Actor, teamId: string, target: RatingTarget): boolean {
  if (actor.userId === target.userId) return false;
  const mine = actor.teams.get(teamId) ?? [];
  if (mine.includes('coach')) return true;
  if (mine.includes('assistant')) {
    return target.roles.includes('coach') || !target.roles.includes('assistant');
  }
  return false;
}

/** Por qué no puede valorarlo, en el tono de la app (para el error del API). */
export function cannotRateMessage(actor: Actor, targetUserId: string): string {
  return actor.userId === targetUserId
    ? 'No puedes valorarte a ti mismo.'
    : 'A los asistentes los valora el entrenador.';
}

/**
 * `canRate` para una lista de jugadores del equipo, con su cuerpo técnico activo
 * (`activeStaff`: una fila por persona y rol).
 */
export function ratableBy(
  actor: Actor,
  teamId: string,
  staff: readonly { userId: string; role: 'coach' | 'assistant' }[],
): (playerId: string) => boolean {
  return (playerId) => {
    const roles: TeamRole[] = [
      'player',
      ...staff.filter((m) => m.userId === playerId).map((m) => m.role),
    ];
    return canRate(actor, teamId, { userId: playerId, roles });
  };
}
