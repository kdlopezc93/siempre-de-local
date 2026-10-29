import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Put } from '@nestjs/common';
import {
  SetInjuryRequestSchema,
  type TeamResponse,
  TransferCoachRequestSchema,
  UpdateMemberRequestSchema,
  UpdateMemberRolesRequestSchema,
  UpdateTeamRequestSchema,
} from '@sdl/contracts';
import { z } from 'zod';

import { Can } from '../../../shared/authz/can.decorator.js';
import { CurrentActor } from '../../../shared/authz/current-actor.decorator.js';
import type { Actor } from '../../../shared/authz/policy.js';
import { parseInput } from '../../../shared/http/validation.js';
import { GetTeam, SetInjury, UpdateMember, UpdateTeam } from '../application/get-team.use-case.js';
import { ChangeMemberRoles, TransferCoach } from '../application/member-roles.use-cases.js';

@Controller('teams')
export class TeamsController {
  constructor(
    private readonly getTeam: GetTeam,
    private readonly updateTeam: UpdateTeam,
    private readonly updateMember: UpdateMember,
    private readonly setInjury: SetInjury,
    private readonly changeRoles: ChangeMemberRoles,
    private readonly transferCoach: TransferCoach,
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

  @Patch(':teamId/members/:userId')
  @Can('team.members.manage', { teamParam: 'teamId' })
  @HttpCode(204)
  async member(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('userId') userId: string,
    @Body() body: unknown,
  ): Promise<void> {
    await this.updateMember.execute(
      actor,
      teamId,
      parseInput(z.uuid(), userId),
      parseInput(UpdateMemberRequestSchema, body),
    );
  }

  /** Sus roles de jugador y de asistente (2026-10-29). */
  @Patch(':teamId/members/:userId/roles')
  @Can('team.members.manage', { teamParam: 'teamId' })
  @HttpCode(204)
  async roles(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('userId') userId: string,
    @Body() body: unknown,
  ): Promise<void> {
    await this.changeRoles.execute(
      actor,
      teamId,
      parseInput(z.uuid(), userId),
      parseInput(UpdateMemberRolesRequestSchema, body),
    );
  }

  /** Pasar el mando de entrenador (2026-10-29). */
  @Put(':teamId/coach')
  @Can('team.members.manage', { teamParam: 'teamId' })
  @HttpCode(204)
  async coach(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Body() body: unknown,
  ): Promise<void> {
    const { userId } = parseInput(TransferCoachRequestSchema, body);
    await this.transferCoach.execute(actor, teamId, userId);
  }

  /** Lesionado (2026-10-24): `{ returnOn }` lo marca o cambia la vuelta; DELETE, volvió. */
  @Put(':teamId/players/:userId/injury')
  @Can('team.injuries.write', { teamParam: 'teamId' })
  @HttpCode(204)
  async injured(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('userId') userId: string,
    @Body() body: unknown,
  ): Promise<void> {
    await this.setInjury.execute(
      actor,
      teamId,
      parseInput(z.uuid(), userId),
      parseInput(SetInjuryRequestSchema, body),
    );
  }

  @Delete(':teamId/players/:userId/injury')
  @Can('team.injuries.write', { teamParam: 'teamId' })
  @HttpCode(204)
  async recovered(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('userId') userId: string,
  ): Promise<void> {
    await this.setInjury.execute(actor, teamId, parseInput(z.uuid(), userId), null);
  }
}
