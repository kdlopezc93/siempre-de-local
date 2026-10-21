import { Controller, Get, Param } from '@nestjs/common';
import type { TeamResponse } from '@sdl/contracts';

import { Can } from '../../../shared/authz/can.decorator.js';
import { CurrentActor } from '../../../shared/authz/current-actor.decorator.js';
import type { Actor } from '../../../shared/authz/policy.js';
import { GetTeam } from '../application/get-team.use-case.js';

@Controller('teams')
export class TeamsController {
  constructor(private readonly getTeam: GetTeam) {}

  @Get(':teamId')
  @Can('team.read', { teamParam: 'teamId' })
  findOne(@CurrentActor() actor: Actor, @Param('teamId') teamId: string): Promise<TeamResponse> {
    return this.getTeam.execute(actor, teamId);
  }
}
