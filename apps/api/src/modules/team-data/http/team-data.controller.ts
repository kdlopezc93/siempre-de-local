import { Body, Controller, Get, Header, Param, Post, Res } from '@nestjs/common';
import {
  type LegacyImportResponse,
  LegacyImportRequestSchema,
  type LegacyResultListResponse,
} from '@sdl/contracts';
import type { FastifyReply } from 'fastify';

import { Can } from '../../../shared/authz/can.decorator.js';
import { CurrentActor } from '../../../shared/authz/current-actor.decorator.js';
import type { Actor } from '../../../shared/authz/policy.js';
import { toCsv } from '../../../shared/http/csv.js';
import { parseInput } from '../../../shared/http/validation.js';
import { ExportTeam, LegacyResults } from '../application/team-data.use-cases.js';

@Controller('teams/:teamId')
export class TeamDataController {
  constructor(
    private readonly exporter: ExportTeam,
    private readonly legacy: LegacyResults,
  ) {}

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

  @Post('legacy-import')
  @Can('team.data.transfer', { teamParam: 'teamId' })
  async import(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Body() body: unknown,
  ): Promise<LegacyImportResponse> {
    const { csv } = parseInput(LegacyImportRequestSchema, body);
    return this.legacy.import(actor, teamId, csv);
  }

  @Get('legacy-results')
  @Can('team.data.transfer', { teamParam: 'teamId' })
  async list(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
  ): Promise<LegacyResultListResponse> {
    return { items: await this.legacy.list(actor, teamId) };
  }
}
