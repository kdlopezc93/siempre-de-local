import { Controller, Get, Param } from '@nestjs/common';
import type { SquadResponse } from '@sdl/contracts';

import { Can } from '../../../shared/authz/can.decorator.js';
import { CurrentActor } from '../../../shared/authz/current-actor.decorator.js';
import type { Actor } from '../../../shared/authz/policy.js';
import { GetSquad } from '../application/get-squad.use-case.js';

@Controller('teams/:teamId/squad')
export class SquadController {
  constructor(private readonly getSquad: GetSquad) {}

  @Get()
  @Can('team.results.read', { teamParam: 'teamId' })
  squad(@CurrentActor() actor: Actor, @Param('teamId') teamId: string): Promise<SquadResponse> {
    return this.getSquad.execute(actor, teamId);
  }
}
