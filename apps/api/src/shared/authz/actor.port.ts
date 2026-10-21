import type { Actor } from './policy.js';

/**
 * Lo que la autorización necesita leer de la BD. Lo implementa el módulo teams;
 * vive aquí para que el guard no dependa de un módulo concreto.
 */
export interface AuthorizationReader {
  /** Membresías activas del usuario en clubs y equipos. */
  loadMemberships(userId: string): Promise<Pick<Actor, 'clubs' | 'teams'>>;
  /** Club dueño del equipo, o null si el equipo no existe. */
  findTeamClubId(teamId: string): Promise<string | null>;
}

export const AUTHORIZATION_READER = Symbol('AUTHORIZATION_READER');
