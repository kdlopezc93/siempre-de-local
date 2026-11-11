import { Inject, Injectable } from '@nestjs/common';
import type { TeamRole, UpdateMemberRolesRequest } from '@sdl/contracts';
import { formatBirthYears } from '@sdl/domain';

import { AUDIT_LOG, type AuditLog } from '../../../shared/audit/audit.port.js';
import { NOTIFIER, type Notifier } from '../../../shared/notifications/notifier.port.js';
import { can, type Actor } from '../../../shared/authz/policy.js';
import {
  BusinessRuleError,
  ConflictError,
  ForbiddenError,
  NotFoundError,
} from '../../../shared/errors/application-errors.js';
import {
  TEAMS_REPOSITORY,
  type RoleChange,
  type TeamsRepository,
} from './ports/teams.repository.js';

/** El coach y el admin del club arman el cuerpo técnico (04 §2.2, Kevin 2026-10-29). */
async function authorize(teams: TeamsRepository, actor: Actor, teamId: string) {
  const team = await teams.findById(teamId);
  if (!team) throw new NotFoundError('Equipo no encontrado');
  if (!can(actor, 'team.members.manage', { teamId: team.id, clubId: team.club.id })) {
    throw new ForbiddenError('No tienes permiso para esto');
  }
  return team;
}

async function rolesOf(teams: TeamsRepository, teamId: string, userId: string) {
  const roles = await teams.activeRoles(teamId, userId);
  if (roles.length === 0) {
    throw new NotFoundError('Esa persona no está en el equipo', 'MEMBER_NOT_IN_TEAM');
  }
  return roles;
}

/**
 * Jugador, asistente y tesorero se prenden y se apagan aparte: alguien del cuerpo técnico puede
 * jugar, y el tesorero puede ser un jugador (2026-10-30). El de entrenador no: ese se pasa
 * (`TransferCoach`); el entrenador ya maneja la plata, así que tampoco es tesorero.
 */
@Injectable()
export class ChangeMemberRoles {
  constructor(
    @Inject(TEAMS_REPOSITORY) private readonly teams: TeamsRepository,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
  ) {}

  async execute(
    actor: Actor,
    teamId: string,
    userId: string,
    request: UpdateMemberRolesRequest,
    now = new Date(),
  ): Promise<void> {
    await authorize(this.teams, actor, teamId);
    const current = await rolesOf(this.teams, teamId, userId);
    if (request.assistant && current.includes('coach')) {
      throw new BusinessRuleError(
        'El entrenador ya es del cuerpo técnico',
        'COACH_CANNOT_BE_ASSISTANT',
      );
    }
    // Un menor a cargo de su acudiente solo juega (2026-11-08).
    if ((request.assistant || request.treasurer) && (await this.teams.isManaged(userId))) {
      throw new BusinessRuleError('Un menor de edad solo puede ser jugador', 'MINOR_ONLY_PLAYS');
    }
    if (request.treasurer && current.includes('coach')) {
      throw new BusinessRuleError(
        'El entrenador ya maneja los cobros',
        'COACH_CANNOT_BE_TREASURER',
      );
    }
    const changes = (['player', 'assistant', 'treasurer'] as const)
      .filter((role) => request[role] !== undefined && request[role] !== current.includes(role))
      .map((role): RoleChange => ({ userId, role, active: request[role]! }));
    const next = new Set<TeamRole>(current);
    for (const { role, active } of changes) {
      if (active) next.add(role);
      else next.delete(role);
    }
    if (next.size === 0) {
      throw new BusinessRuleError(
        'Tiene que quedar con algún rol en el equipo',
        'MEMBER_NEEDS_ROLE',
      );
    }
    if (changes.length === 0) return;
    await this.teams.changeRoles(teamId, changes, now);
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'team.roles_changed',
      entity: 'team_membership',
      entityId: userId,
      teamId,
      meta: Object.fromEntries(changes.map((c) => [c.role, c.active])),
    });
  }
}

/**
 * Quitar del equipo al que ya no viene (Kevin, 2026-10-24 y 2026-10-29): todas sus filas quedan
 * con `left_at`, así su historial sigue y deja de contar. Si vuelve con una invitación, recupera
 * su dorsal. Al entrenador no: primero se pasa el mando.
 */
@Injectable()
export class RemoveMember {
  constructor(
    @Inject(TEAMS_REPOSITORY) private readonly teams: TeamsRepository,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
  ) {}

  async execute(actor: Actor, teamId: string, userId: string, now = new Date()): Promise<void> {
    await authorize(this.teams, actor, teamId);
    const roles = await rolesOf(this.teams, teamId, userId);
    if (roles.includes('coach')) {
      throw new BusinessRuleError(
        'Al entrenador no se le quita: primero pásale el mando a otro',
        'COACH_CANNOT_BE_REMOVED',
      );
    }
    // Si vuelve, no vuelve lesionado de hace meses.
    if (roles.includes('player')) await this.teams.setInjury(teamId, userId, null);
    await this.teams.changeRoles(
      teamId,
      roles.map((role) => ({ userId, role, active: false })),
      now,
    );
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'team.member_removed',
      entity: 'team_membership',
      entityId: userId,
      teamId,
      meta: { roles },
    });
  }
}

/** Un solo entrenador por equipo: el anterior queda de asistente (Kevin, 2026-10-29). */
@Injectable()
export class TransferCoach {
  constructor(
    @Inject(TEAMS_REPOSITORY) private readonly teams: TeamsRepository,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
  ) {}

  async execute(actor: Actor, teamId: string, userId: string, now = new Date()): Promise<void> {
    await authorize(this.teams, actor, teamId);
    const roles = await rolesOf(this.teams, teamId, userId);
    if (await this.teams.isManaged(userId)) {
      throw new BusinessRuleError('Un menor de edad solo puede ser jugador', 'MINOR_ONLY_PLAYS');
    }
    if (roles.includes('coach')) return;
    const previous = await this.teams.activeCoaches(teamId);
    await this.teams.changeRoles(
      teamId,
      [
        ...previous.flatMap((id): RoleChange[] => [
          { userId: id, role: 'coach', active: false },
          { userId: id, role: 'assistant', active: true },
        ]),
        { userId, role: 'assistant', active: false },
        { userId, role: 'coach', active: true },
      ],
      now,
    );
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'team.coach_transferred',
      entity: 'team_membership',
      entityId: userId,
      teamId,
      meta: { from: previous },
    });
  }
}

/**
 * Pasar a un jugador a otro grupo de la misma escuela (2026-11-10, Kevin): "Sub-12 masculino A"
 * a "B" de un toque. Quien lo hace maneja los dos grupos (su profe en ambos, o el admin de la
 * escuela). Un menor solo pasa a un grupo de sus años. Le avisa (a un menor, a sus acudientes).
 */
@Injectable()
export class MovePlayer {
  constructor(
    @Inject(TEAMS_REPOSITORY) private readonly teams: TeamsRepository,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
    @Inject(NOTIFIER) private readonly notifier: Notifier,
  ) {}

  async execute(
    actor: Actor,
    teamId: string,
    userId: string,
    toTeamId: string,
    now = new Date(),
  ): Promise<void> {
    const from = await authorize(this.teams, actor, teamId);
    if (toTeamId === teamId) {
      throw new BusinessRuleError('Ya está en ese grupo', 'SAME_GROUP');
    }
    const to = await this.teams.findById(toTeamId);
    if (!to || to.club.id !== from.club.id) {
      throw new NotFoundError('Ese grupo no es de esta escuela', 'GROUP_NOT_FOUND');
    }
    if (from.club.kind !== 'school') {
      throw new BusinessRuleError('Esto es solo para escuelas', 'SCHOOL_ONLY');
    }
    await authorize(this.teams, actor, toTeamId);
    const roles = await rolesOf(this.teams, teamId, userId);
    if (!roles.includes('player')) {
      throw new BusinessRuleError('Solo se pasa de grupo a los jugadores', 'NOT_A_PLAYER');
    }
    if ((await this.teams.activeRoles(toTeamId, userId)).includes('player')) {
      throw new ConflictError('Ya juega en ese grupo', 'ALREADY_IN_GROUP');
    }
    const birthYear = await this.teams.birthYearOf(userId);
    const years = to.birthYears;
    if (
      birthYear !== null &&
      years &&
      (birthYear > years.to || (years.from !== null && birthYear < years.from))
    ) {
      throw new BusinessRuleError(
        `${to.name} es de nacidos en ${formatBirthYears(years)}.`,
        'CHILD_NOT_IN_CATEGORY',
      );
    }
    await this.teams.movePlayer(teamId, toTeamId, userId, now);
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'team.player_moved',
      entity: 'team_membership',
      entityId: userId,
      teamId,
      meta: { toTeamId },
    });
    await this.notifier.notifyUsers([userId], {
      kind: 'group-moved',
      team: to.name,
      opponent: to.name,
      url: `/equipos/${toTeamId}/partidos`,
    });
  }
}
