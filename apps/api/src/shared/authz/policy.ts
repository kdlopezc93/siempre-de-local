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
  'team.attempts.void': { roles: ['coach'], clubAdmin: true },
  'team.reevaluations.request': { roles: ['coach'], clubAdmin: true },
  'team.players.invite': { roles: ['coach'], clubAdmin: true },
  'team.staff.invite': { roles: [], clubAdmin: true },
  /** El coach solo gestiona jugadores; esa restricción fina va en el caso de uso. */
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
