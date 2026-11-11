import { Inject, Injectable } from '@nestjs/common';

import {
  AUTHORIZATION_READER,
  type AuthorizationReader,
} from '../../../shared/authz/actor.port.js';
import type { Actor } from '../../../shared/authz/policy.js';
import { NotFoundError } from '../../../shared/errors/application-errors.js';
import { FAMILIES_REPOSITORY, type FamiliesRepository } from './ports/families.repository.js';

/**
 * El acudiente actúa por su hijo (escuelas, PR 3, 2026-11-10): el actor es el niño, con sus
 * membresías (solo de jugador), y lleva al acudiente para la auditoría. Solo lo usan las rutas
 * acotadas de `/me/children/:minorId` (ver sus partidos y responder, ver y reportar sus cobros);
 * el acudiente no entra al equipo ni ve nada más de él.
 */
@Injectable()
export class ChildActors {
  constructor(
    @Inject(FAMILIES_REPOSITORY) private readonly families: FamiliesRepository,
    @Inject(AUTHORIZATION_READER) private readonly memberships: AuthorizationReader,
  ) {}

  async actorFor(guardianUserId: string, minorUserId: string): Promise<Actor> {
    // Un niño ajeno es lo mismo que uno que no existe: no se revela.
    if (!(await this.families.isGuardianOf(guardianUserId, minorUserId))) {
      throw new NotFoundError(
        'No encontramos a ese deportista entre los tuyos.',
        'CHILD_NOT_FOUND',
      );
    }
    const { teams } = await this.memberships.loadMemberships(minorUserId);
    return { userId: minorUserId, platformAdmin: false, clubs: new Map(), teams, guardianUserId };
  }
}
