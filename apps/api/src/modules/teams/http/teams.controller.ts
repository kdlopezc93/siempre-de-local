import { Body, Controller, Get, Param, Patch } from '@nestjs/common';
import { type TeamResponse, UpdateTeamRequestSchema } from '@sdl/contracts';

import { Can } from '../../../shared/authz/can.decorator.js';
import { CurrentActor } from '../../../shared/authz/current-actor.decorator.js';
import type { Actor } from '../../../shared/authz/policy.js';
import { parseInput } from '../../../shared/http/validation.js';
import { GetTeam, UpdateTeam } from '../application/get-team.use-case.js';

@Controller('teams')
export class TeamsController {
  constructor(
    private readonly getTeam: GetTeam,
    private readonly updateTeam: UpdateTeam,
  ) {}

  @Get(':teamId')
  @Can('team.read', { teamParam: 'teamId' })
  findOne(@CurrentActor() actor: Actor, @Param('teamId') teamId: string): Promise<TeamResponse> {
    return this.getTeam.execute(actor, teamId);
  }

  @Patch(':teamId')
  @Can('team.settings.write', { teamParam: 'teamId' })
  update(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Body() body: unknown,
  ): Promise<TeamResponse> {
    return this.updateTeam.execute(actor, teamId, parseInput(UpdateTeamRequestSchema, body));
  }
}
