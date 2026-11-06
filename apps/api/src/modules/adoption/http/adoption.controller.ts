import { Controller, Get, Param } from '@nestjs/common';
import type { AdoptionResponse } from '@sdl/contracts';

import { Can } from '../../../shared/authz/can.decorator.js';
import { CurrentActor } from '../../../shared/authz/current-actor.decorator.js';
import type { Actor } from '../../../shared/authz/policy.js';
import { GetAdoption } from '../application/adoption.use-case.js';

/** La app en el equipo (2026-11-06): cuerpo técnico y administradores del club. */
@Controller('teams/:teamId/adoption')
export class AdoptionController {
  constructor(private readonly adoption: GetAdoption) {}

  @Get()
  @Can('team.results.read', { teamParam: 'teamId' })
  get(@CurrentActor() actor: Actor, @Param('teamId') teamId: string): Promise<AdoptionResponse> {
    return this.adoption.execute(actor, teamId);
  }
}
