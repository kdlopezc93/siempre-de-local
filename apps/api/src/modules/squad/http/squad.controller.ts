import { Controller, Get, Param } from '@nestjs/common';
import type { LineupInputsResponse, PlayerProfileResponse, SquadResponse } from '@sdl/contracts';
import { z } from 'zod';

import { Can } from '../../../shared/authz/can.decorator.js';
import { CurrentActor } from '../../../shared/authz/current-actor.decorator.js';
import type { Actor } from '../../../shared/authz/policy.js';
import { parseInput } from '../../../shared/http/validation.js';
import { GetLineupInputs } from '../application/get-lineup-inputs.use-case.js';
import { GetPlayerProfile } from '../application/get-player-profile.use-case.js';
import { GetSquad } from '../application/get-squad.use-case.js';

@Controller('teams/:teamId')
export class SquadController {
  constructor(
    private readonly getSquad: GetSquad,
    private readonly getProfile: GetPlayerProfile,
    private readonly getInputs: GetLineupInputs,
  ) {}

  @Get('squad')
  @Can('team.results.read', { teamParam: 'teamId' })
  squad(@CurrentActor() actor: Actor, @Param('teamId') teamId: string): Promise<SquadResponse> {
    return this.getSquad.execute(actor, teamId);
  }

  @Get('players/:playerId/profile')
  @Can('team.results.read', { teamParam: 'teamId' })
  profile(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('playerId') playerId: string,
  ): Promise<PlayerProfileResponse> {
    return this.getProfile.execute(actor, teamId, parseInput(z.uuid(), playerId));
  }

  /** Señales de cada jugador para armar la alineación en el celular. */
  @Get('lineup-inputs')
  @Can('team.results.read', { teamParam: 'teamId' })
  lineupInputs(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
  ): Promise<LineupInputsResponse> {
    return this.getInputs.execute(actor, teamId);
  }
}
