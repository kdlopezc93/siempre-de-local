import { Inject, Injectable } from '@nestjs/common';
import type { TeamResponse, UpdateTeamRequest } from '@sdl/contracts';

import { AUDIT_LOG, type AuditLog } from '../../../shared/audit/audit.port.js';
import { ForbiddenError, NotFoundError } from '../../../shared/errors/application-errors.js';
import { can, type Actor } from '../../../shared/authz/policy.js';
import { TEAMS_REPOSITORY, type TeamsRepository } from './ports/teams.repository.js';

@Injectable()
export class GetTeam {
  constructor(@Inject(TEAMS_REPOSITORY) private readonly teams: TeamsRepository) {}

  async execute(actor: Actor, teamId: string): Promise<TeamResponse> {
    const team = await this.teams.findById(teamId);
    if (!team) throw new NotFoundError('Equipo no encontrado');
    // El guard ya filtró; la decisión final es de aquí (CLAUDE.md · Reglas de código).
    if (!can(actor, 'team.read', { teamId: team.id, clubId: team.club.id })) {
      throw new ForbiddenError('No tienes permiso para esto');
    }
    return { team, myRoles: [...(actor.teams.get(team.id) ?? [])] };
  }
}

@Injectable()
export class UpdateTeam {
  constructor(
    @Inject(TEAMS_REPOSITORY) private readonly teams: TeamsRepository,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
  ) {}

  async execute(actor: Actor, teamId: string, patch: UpdateTeamRequest): Promise<TeamResponse> {
    const team = await this.teams.findById(teamId);
    if (!team) throw new NotFoundError('Equipo no encontrado');
    if (!can(actor, 'team.settings.write', { teamId: team.id, clubId: team.club.id })) {
      throw new ForbiddenError('No tienes permiso para esto');
    }
    await this.teams.updateSettings(team.id, patch);
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'team.settings_updated',
      entity: 'team',
      entityId: team.id,
      teamId: team.id,
      meta: { ...patch },
    });
    return { team: { ...team, ...patch }, myRoles: [...(actor.teams.get(team.id) ?? [])] };
  }
}
