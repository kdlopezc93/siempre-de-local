import type { GuardianRelationship } from '@sdl/contracts';

export interface NewMinor {
  guardianUserId: string;
  name: string;
  birthYear: number;
  relationship: GuardianRelationship;
  authorizationVersion: string;
  at: Date;
}

export interface FamiliesRepository {
  /** El hijo de ese acudiente con ese nombre (sin tildes ni mayúsculas) y año, si ya lo inscribió. */
  findChild(guardianUserId: string, name: string, birthYear: number): Promise<string | null>;
  /**
   * En una transacción: el menor (un usuario sin método de entrada, con correo interno) y su
   * acudiente con la autorización que aceptó. Devuelve el id del menor.
   */
  createMinor(minor: NewMinor): Promise<string>;
  /** Si ese menor está a cargo de ese acudiente (2026-11-10). */
  isGuardianOf(guardianUserId: string, minorUserId: string): Promise<boolean>;
}

export const FAMILIES_REPOSITORY = Symbol('FAMILIES_REPOSITORY');
