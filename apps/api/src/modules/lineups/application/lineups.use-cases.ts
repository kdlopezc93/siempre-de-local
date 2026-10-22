import { Inject, Injectable } from '@nestjs/common';
import type { Lineup, LineupInputSchema } from '@sdl/contracts';
import { findFormation } from '@sdl/domain';
import type { z } from 'zod';

import { can, type Actor, type TeamPermission } from '../../../shared/authz/policy.js';
import {
  BusinessRuleError,
  ForbiddenError,
  NotFoundError,
} from '../../../shared/errors/application-errors.js';
import {
  TEAM_PLAYERS_QUERY,
  type TeamPlayersQuery,
} from '../../squad/application/ports/squad.ports.js';
import {
  TEAMS_REPOSITORY,
  type TeamRecord,
  type TeamsRepository,
} from '../../teams/application/ports/teams.repository.js';
import { LINEUPS_REPOSITORY, type LineupsRepository } from './ports/lineups.repository.js';

type LineupInput = z.output<typeof LineupInputSchema>;

const invalid = (message: string) => new BusinessRuleError(message, 'LINEUP_INVALID');

/**
 * Alineaciones guardadas (02 §9). Se arman en el celular; el servidor no recalcula, pero
 * comprueba que la foto sea coherente con la formación y la plantilla.
 */
@Injectable()
export class Lineups {
  constructor(
    @Inject(LINEUPS_REPOSITORY) private readonly lineups: LineupsRepository,
    @Inject(TEAMS_REPOSITORY) private readonly teams: TeamsRepository,
    @Inject(TEAM_PLAYERS_QUERY) private readonly players: TeamPlayersQuery,
  ) {}

  async create(actor: Actor, teamId: string, input: LineupInput): Promise<Lineup> {
    const team = await this.authorize(actor, teamId, 'team.lineups.write');
    await this.validate(team, input);
    return strip(await this.lineups.create(teamId, actor.userId, team.format, input));
  }

  async update(actor: Actor, teamId: string, lineupId: string, input: LineupInput) {
    const team = await this.authorize(actor, teamId, 'team.lineups.write');
    await this.own(teamId, lineupId);
    await this.validate(team, input);
    return strip(await this.lineups.update(lineupId, input));
  }

  async remove(actor: Actor, teamId: string, lineupId: string) {
    await this.authorize(actor, teamId, 'team.lineups.write');
    await this.own(teamId, lineupId);
    await this.lineups.delete(lineupId);
  }

  async get(actor: Actor, teamId: string, lineupId: string): Promise<Lineup> {
    await this.authorize(actor, teamId, 'team.results.read');
    return strip(await this.own(teamId, lineupId));
  }

  async list(actor: Actor, teamId: string): Promise<Lineup[]> {
    await this.authorize(actor, teamId, 'team.results.read');
    return (await this.lineups.listByTeam(teamId)).map(strip);
  }

  private async own(teamId: string, lineupId: string) {
    const found = await this.lineups.find(lineupId);
    if (!found || found.teamId !== teamId) throw new NotFoundError('Alineación no encontrada');
    return found;
  }

  private async validate(team: TeamRecord, input: LineupInput) {
    const formation = findFormation(input.formation);
    if (!formation || formation.format !== team.format) {
      throw new BusinessRuleError(
        'Esa formación no es del formato del equipo.',
        'FORMATION_INVALID',
      );
    }
    const roster = new Set((await this.players.activePlayers(team.id)).map((p) => p.userId));
    const available = new Set(input.available);
    if (available.size !== input.available.length) throw invalid('Hay convocados repetidos.');
    if (input.available.some((id) => !roster.has(id))) {
      throw new BusinessRuleError(
        'Hay convocados que no están en el equipo.',
        'PLAYER_NOT_IN_TEAM',
      );
    }
    const slotIds = formation.slots.map((s) => s.id);
    const given = input.assignments.map((a) => a.slotId);
    if (given.length !== slotIds.length || !slotIds.every((id) => given.includes(id))) {
      throw invalid('Los puestos no son los de la formación.');
    }
    const onPitch = input.assignments.flatMap((a) => (a.playerId ? [a.playerId] : []));
    const used = [...onPitch, ...input.bench];
    if (new Set(used).size !== used.length) {
      throw invalid('Un jugador aparece dos veces (en la cancha o en la banca).');
    }
    if (used.some((id) => !available.has(id)))
      throw invalid('Hay jugadores que no están convocados.');
    for (const pin of input.pins) {
      const at = input.assignments.find((a) => a.slotId === pin.slotId);
      if (!at || at.playerId !== pin.playerId)
        throw invalid('Un jugador fijado no está en su puesto.');
    }
  }

  private async authorize(actor: Actor, teamId: string, permission: TeamPermission) {
    const team = await this.teams.findById(teamId);
    if (!team) throw new NotFoundError('Equipo no encontrado');
    if (!can(actor, permission, { teamId, clubId: team.club.id })) {
      throw new ForbiddenError('No tienes permiso para esto');
    }
    return team;
  }
}

/** El `teamId` interno no viaja: ya va en la ruta. */
function strip({ teamId: _, ...lineup }: Lineup & { teamId?: string }): Lineup {
  return lineup;
}
