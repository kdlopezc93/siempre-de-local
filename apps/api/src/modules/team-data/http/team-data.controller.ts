import { Controller, Get, Header, Param, Res } from '@nestjs/common';
import type { FastifyReply } from 'fastify';

import { Can } from '../../../shared/authz/can.decorator.js';
import { CurrentActor } from '../../../shared/authz/current-actor.decorator.js';
import type { Actor } from '../../../shared/authz/policy.js';
import { toCsv } from '../../../shared/http/csv.js';
import { ExportTeam } from '../application/team-data.use-cases.js';

@Controller('teams/:teamId')
export class TeamDataController {
  constructor(private readonly exporter: ExportTeam) {}

  @Get('export.csv')
  @Can('team.data.transfer', { teamParam: 'teamId' })
  @Header('Cache-Control', 'no-store')
  async export(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<string> {
    const { filename, rows } = await this.exporter.execute(actor, teamId);
    reply
      .type('text/csv; charset=utf-8')
      .header('Content-Disposition', `attachment; filename="${filename}"`);
    return toCsv(rows);
  }
}
