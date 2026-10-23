import { Inject, Injectable } from '@nestjs/common';
import type { TeamResponse, UpdateMemberRequest, UpdateTeamRequest } from '@sdl/contracts';

import { AUDIT_LOG, type AuditLog } from '../../../shared/audit/audit.port.js';
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../shared/errors/application-errors.js';
import { can, type Actor } from '../../../shared/authz/policy.js';
import {
  TEAMS_REPOSITORY,
  type TeamSettings,
  type TeamsRepository,
} from './ports/teams.repository.js';

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
    // Solo lo que vino (Zod deja `undefined` en lo que no).
    const changes = Object.fromEntries(
      Object.entries(patch).filter(([, value]) => value !== undefined),
    ) as TeamSettings;
    // El principal (D14) tiene que estar entre los formatos en que juega.
    const formats = patch.formats ?? team.formats;
    const format = patch.format ?? team.format;
    if (!formats.includes(format)) {
      throw new BusinessRuleError(
        'El formato principal tiene que ser uno de los que juega el equipo',
        'TEAM_FORMAT_NOT_PLAYED',
      );
    }
    if ((await this.teams.updateSettings(team.id, changes)) === 'name-taken') {
      throw new ConflictError(
        'Ya hay otro equipo con ese nombre en el club esta temporada',
        'TEAM_NAME_TAKEN',
      );
    }
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'team.settings_updated',
      entity: 'team',
      entityId: team.id,
      teamId: team.id,
      meta: { ...changes },
    });
    return { team: { ...team, ...changes }, myRoles: [...(actor.teams.get(team.id) ?? [])] };
  }
}

/** El cuerpo técnico pone el dorsal de un jugador (coach y admin del club). */
@Injectable()
export class UpdateMember {
  constructor(
    @Inject(TEAMS_REPOSITORY) private readonly teams: TeamsRepository,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
  ) {}

  async execute(
    actor: Actor,
    teamId: string,
    userId: string,
    patch: UpdateMemberRequest,
  ): Promise<void> {
    const team = await this.teams.findById(teamId);
    if (!team) throw new NotFoundError('Equipo no encontrado');
    if (!can(actor, 'team.members.manage', { teamId: team.id, clubId: team.club.id })) {
      throw new ForbiddenError('No tienes permiso para esto');
    }
    // El coach solo gestiona jugadores (04 §2.2): el dorsal es de la fila de jugador.
    if (!(await this.teams.setJerseyNumber(team.id, userId, patch.jerseyNumber))) {
      throw new NotFoundError('Ese jugador no está en el equipo', 'PLAYER_NOT_IN_TEAM');
    }
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'team.member_updated',
      entity: 'team_membership',
      entityId: userId,
      teamId: team.id,
      meta: { ...patch },
    });
  }
}
