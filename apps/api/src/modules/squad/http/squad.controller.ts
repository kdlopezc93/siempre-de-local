import { Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import type {
  LineupInputsResponse,
  PlayerProfileResponse,
  SquadResponse,
  TeamMembersResponse,
  TestReminderResponse,
  ValidationResponse,
} from '@sdl/contracts';
import { z } from 'zod';

import { Can } from '../../../shared/authz/can.decorator.js';
import { CurrentActor } from '../../../shared/authz/current-actor.decorator.js';
import type { Actor } from '../../../shared/authz/policy.js';
import { parseInput } from '../../../shared/http/validation.js';
import { GetLineupInputs } from '../application/get-lineup-inputs.use-case.js';
import { GetPlayerProfile } from '../application/get-player-profile.use-case.js';
import { GetSquad } from '../application/get-squad.use-case.js';
import { GetTeamMembers } from '../application/get-team-members.use-case.js';
import { GetValidation } from '../application/get-validation.use-case.js';
import { RemindTest } from '../application/remind-test.use-case.js';

@Controller('teams/:teamId')
export class SquadController {
  constructor(
    private readonly getSquad: GetSquad,
    private readonly getProfile: GetPlayerProfile,
    private readonly getInputs: GetLineupInputs,
    private readonly getValidation: GetValidation,
    private readonly getMembers: GetTeamMembers,
    private readonly remindTest: RemindTest,
  ) {}

  /** Recordarles el test a los que no lo han hecho (cuerpo técnico, 2026-10-26). */
  @Post('test-reminders')
  @HttpCode(200)
  @Can('team.reminders.send', { teamParam: 'teamId' })
  testReminders(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
  ): Promise<TestReminderResponse> {
    return this.remindTest.execute(actor, teamId);
  }

  /** Los integrantes, para todo el equipo (D11: de los jugadores, solo su mejor banda). */
  @Get('members')
  @Can('team.read', { teamParam: 'teamId' })
  members(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
  ): Promise<TeamMembersResponse> {
    return this.getMembers.execute(actor, teamId);
  }

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

  /** Validación interna (02 §11). */
  @Get('validation')
  @Can('team.results.read', { teamParam: 'teamId' })
  validation(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
  ): Promise<ValidationResponse> {
    return this.getValidation.execute(actor, teamId);
  }
}
