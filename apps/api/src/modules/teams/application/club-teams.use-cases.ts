import { Inject, Injectable } from '@nestjs/common';
import type { CreateTeamRequestSchema, CreateTeamResponse } from '@sdl/contracts';
import type { z } from 'zod';

import { AUDIT_LOG, type AuditLog } from '../../../shared/audit/audit.port.js';
import {
  AUTHORIZATION_READER,
  type AuthorizationReader,
} from '../../../shared/authz/actor.port.js';
import { ConflictError, ForbiddenError } from '../../../shared/errors/application-errors.js';
import { TEAMS_REPOSITORY, type TeamsRepository } from './ports/teams.repository.js';

/** Hasta 3 equipos activos por club (Kevin, 2026-10-29); más, cuando haya plan pago. */
export const TEAMS_PER_CLUB = 3;

/**
 * Otro equipo del club (Kevin, 2026-10-29): lo crea el dueño o un admin del club y queda de
 * entrenador. Si lo va a entrenar otra persona, la invita como entrenador desde ese equipo y al
 * aceptar se pasa el mando (#124); así nunca queda un equipo sin nadie que lo maneje.
 */
@Injectable()
export class CreateTeam {
  constructor(
    @Inject(TEAMS_REPOSITORY) private readonly teams: TeamsRepository,
    @Inject(AUTHORIZATION_READER) private readonly memberships: AuthorizationReader,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
  ) {}

  async execute(
    userId: string,
    clubId: string,
    request: z.output<typeof CreateTeamRequestSchema>,
    now = new Date(),
  ): Promise<CreateTeamResponse> {
    const mine = await this.memberships.loadMemberships(userId);
    if (!mine.clubs.has(clubId)) {
      throw new ForbiddenError('Solo el dueño y los admins del club crean equipos');
    }
    const outcome = await this.teams.createTeam(
      clubId,
      userId,
      {
        name: request.name,
        category: request.category || null,
        format: request.format,
        season: request.season,
        alsoPlays: request.alsoPlays,
      },
      TEAMS_PER_CLUB,
      now,
    );
    if (outcome === 'limit') {
      throw new ConflictError(
        `El club ya tiene ${TEAMS_PER_CLUB} equipos. Para abrir otro, escríbenos.`,
        'TEAM_LIMIT_REACHED',
      );
    }
    if (outcome === 'name-taken') {
      throw new ConflictError(
        'Ya hay otro equipo con ese nombre en el club esta temporada',
        'TEAM_NAME_TAKEN',
      );
    }
    await this.audit.record({
      actorUserId: userId,
      action: 'team.created',
      entity: 'team',
      entityId: outcome.teamId,
      teamId: outcome.teamId,
      meta: { clubId },
    });
    return outcome;
  }
}
