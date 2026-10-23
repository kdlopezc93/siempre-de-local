import { Body, Controller, Get, Param, Patch, Post, Put } from '@nestjs/common';
import {
  CreateMatchRequestSchema,
  type MatchListResponse,
  MatchReplyRequestSchema,
  type MatchResponse,
  UpdateMatchRequestSchema,
} from '@sdl/contracts';
import { z } from 'zod';

import { Can } from '../../../shared/authz/can.decorator.js';
import { CurrentActor } from '../../../shared/authz/current-actor.decorator.js';
import type { Actor } from '../../../shared/authz/policy.js';
import { parseInput } from '../../../shared/http/validation.js';
import { Matches } from '../application/matches.use-cases.js';

/** Partidos del equipo (Fase 7). */
@Controller('teams/:teamId/matches')
export class MatchesController {
  constructor(private readonly matches: Matches) {}

  @Get()
  @Can('team.read', { teamParam: 'teamId' })
  async list(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
  ): Promise<MatchListResponse> {
    return { items: await this.matches.list(actor, teamId) };
  }

  @Post()
  @Can('team.matches.write', { teamParam: 'teamId' })
  create(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Body() body: unknown,
  ): Promise<MatchResponse> {
    return this.matches.create(actor, teamId, parseInput(CreateMatchRequestSchema, body));
  }

  @Get(':matchId')
  @Can('team.read', { teamParam: 'teamId' })
  get(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('matchId') matchId: string,
  ): Promise<MatchResponse> {
    return this.matches.get(actor, teamId, parseInput(z.uuid(), matchId));
  }

  @Patch(':matchId')
  @Can('team.matches.write', { teamParam: 'teamId' })
  update(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('matchId') matchId: string,
    @Body() body: unknown,
  ): Promise<MatchResponse> {
    return this.matches.update(
      actor,
      teamId,
      parseInput(z.uuid(), matchId),
      parseInput(UpdateMatchRequestSchema, body),
    );
  }

  @Put(':matchId/reply')
  @Can('team.read', { teamParam: 'teamId' })
  reply(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('matchId') matchId: string,
    @Body() body: unknown,
  ): Promise<MatchResponse> {
    return this.matches.reply(
      actor,
      teamId,
      parseInput(z.uuid(), matchId),
      parseInput(MatchReplyRequestSchema, body).reply,
    );
  }
}
