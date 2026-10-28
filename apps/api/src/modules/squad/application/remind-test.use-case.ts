import { Inject, Injectable } from '@nestjs/common';
import type { TestReminderResponse } from '@sdl/contracts';

import { can, type Actor } from '../../../shared/authz/policy.js';
import { AUDIT_LOG, type AuditLog } from '../../../shared/audit/audit.port.js';
import { ForbiddenError, NotFoundError } from '../../../shared/errors/application-errors.js';
import { NOTIFIER, type Notifier } from '../../../shared/notifications/notifier.port.js';
import {
  TEAMS_REPOSITORY,
  type TeamsRepository,
} from '../../teams/application/ports/teams.repository.js';
import {
  LATEST_RESULTS_QUERY,
  type LatestResultsQuery,
  TEAM_PLAYERS_QUERY,
  type TeamPlayersQuery,
} from './ports/squad.ports.js';

/**
 * El cuerpo técnico les recuerda el test a los que no lo han hecho (2026-10-26): un aviso al
 * celular de los que los activaron; en el inicio ya les aparece "Haz tu test de posición".
 */
@Injectable()
export class RemindTest {
  constructor(
    @Inject(TEAMS_REPOSITORY) private readonly teams: TeamsRepository,
    @Inject(TEAM_PLAYERS_QUERY) private readonly players: TeamPlayersQuery,
    @Inject(LATEST_RESULTS_QUERY) private readonly results: LatestResultsQuery,
    @Inject(NOTIFIER) private readonly notifier: Notifier,
    @Inject(AUDIT_LOG) private readonly audit: AuditLog,
  ) {}

  async execute(actor: Actor, teamId: string): Promise<TestReminderResponse> {
    const team = await this.teams.findById(teamId);
    if (!team) throw new NotFoundError('Equipo no encontrado');
    if (!can(actor, 'team.reminders.send', { teamId, clubId: team.club.id })) {
      throw new ForbiddenError('No tienes permiso para esto');
    }
    const [players, results] = await Promise.all([
      this.players.activePlayers(teamId),
      this.results.latestByTeam(teamId),
    ]);
    const pending = players.map((p) => p.userId).filter((id) => !results.has(id));
    await this.notifier.notifyUsers(pending, {
      kind: 'test-reminder',
      team: team.name,
      opponent: team.name,
      url: `/equipos/${teamId}/test`,
    });
    await this.audit.record({
      actorUserId: actor.userId,
      action: 'team.test_reminder_sent',
      entity: 'team',
      entityId: teamId,
      teamId,
      meta: { players: pending.length },
    });
    return { reminded: pending.length };
  }
}
