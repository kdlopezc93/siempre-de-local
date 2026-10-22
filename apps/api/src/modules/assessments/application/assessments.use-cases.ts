import { Inject, Injectable } from '@nestjs/common';
import type { Assessment, CreateAssessmentRequestSchema } from '@sdl/contracts';
import type { z } from 'zod';

import {
  AUTHORIZATION_READER,
  type AuthorizationReader,
} from '../../../shared/authz/actor.port.js';
import { can, type Actor, type TeamPermission } from '../../../shared/authz/policy.js';
import { ForbiddenError, NotFoundError } from '../../../shared/errors/application-errors.js';
import {
  ASSESSMENTS_REPOSITORY,
  type AssessmentsRepository,
} from './ports/assessments.repository.js';

@Injectable()
export class CoachAssessments {
  constructor(
    @Inject(ASSESSMENTS_REPOSITORY) private readonly assessments: AssessmentsRepository,
    @Inject(AUTHORIZATION_READER) private readonly memberships: AuthorizationReader,
  ) {}

  async create(
    actor: Actor,
    teamId: string,
    request: z.output<typeof CreateAssessmentRequestSchema>,
  ): Promise<Assessment> {
    await this.authorize(actor, teamId, 'team.assessments.write');
    const player = await this.memberships.loadMemberships(request.playerId);
    if (!player.teams.get(teamId)?.includes('player')) {
      throw new NotFoundError('Ese jugador no está en el equipo', 'PLAYER_NOT_IN_TEAM');
    }
    // A ciegas = su primera valoración de este jugador: hasta hacerla, la app no le
    // mostró el test (GetSquad). Las siguientes ya se hacen con el test a la vista.
    const assessed = await this.assessments.assessedBy(actor.userId, teamId);
    return this.assessments.create({
      teamId,
      playerUserId: request.playerId,
      coachUserId: actor.userId,
      primaryPosition: request.primaryPosition,
      secondaryPositions: request.secondaryPositions,
      confidence: request.confidence,
      blind: !assessed.has(request.playerId),
      notes: request.notes || null,
    });
  }

  async list(actor: Actor, teamId: string, playerId?: string): Promise<Assessment[]> {
    await this.authorize(actor, teamId, 'team.results.read');
    return this.assessments.listByTeam(teamId, playerId);
  }

  private async authorize(actor: Actor, teamId: string, permission: TeamPermission) {
    const clubId = await this.memberships.findTeamClubId(teamId);
    if (!clubId) throw new NotFoundError('Equipo no encontrado');
    if (!can(actor, permission, { teamId, clubId })) {
      throw new ForbiddenError('No tienes permiso para esto');
    }
  }
}
