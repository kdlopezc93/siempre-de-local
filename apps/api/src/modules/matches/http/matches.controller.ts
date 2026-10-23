import { Body, Controller, Delete, Get, Param, Patch, Post, Put } from '@nestjs/common';
import {
  CreateMatchRequestSchema,
  type MatchListResponse,
  MatchRatingRequestSchema,
  type MatchRatingsResponse,
  MatchReplyRequestSchema,
  type MatchResponse,
  MatchResultRequestSchema,
  type PlayerMatchRatingsResponse,
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

  /** Después del partido (D18): resultado y figura. */
  @Put(':matchId/result')
  @Can('team.matches.write', { teamParam: 'teamId' })
  recordResult(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('matchId') matchId: string,
    @Body() body: unknown,
  ): Promise<MatchResponse> {
    return this.matches.recordResult(
      actor,
      teamId,
      parseInput(z.uuid(), matchId),
      parseInput(MatchResultRequestSchema, body),
    );
  }

  @Get(':matchId/ratings')
  @Can('team.results.read', { teamParam: 'teamId' })
  ratings(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('matchId') matchId: string,
  ): Promise<MatchRatingsResponse> {
    return this.matches.ratings(actor, teamId, parseInput(z.uuid(), matchId));
  }

  @Put(':matchId/ratings/:playerId')
  @Can('team.ratings.write', { teamParam: 'teamId' })
  rate(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('matchId') matchId: string,
    @Param('playerId') playerId: string,
    @Body() body: unknown,
  ): Promise<MatchRatingsResponse> {
    return this.matches.rate(
      actor,
      teamId,
      parseInput(z.uuid(), matchId),
      parseInput(z.uuid(), playerId),
      parseInput(MatchRatingRequestSchema, body),
    );
  }

  @Delete(':matchId/ratings/:playerId')
  @Can('team.ratings.write', { teamParam: 'teamId' })
  unrate(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('matchId') matchId: string,
    @Param('playerId') playerId: string,
  ): Promise<MatchRatingsResponse> {
    return this.matches.unrate(
      actor,
      teamId,
      parseInput(z.uuid(), matchId),
      parseInput(z.uuid(), playerId),
    );
  }
}

/** Cómo le fue a un jugador partido a partido (ficha del jugador, cuerpo técnico). */
@Controller('teams/:teamId/players/:playerId/match-ratings')
export class PlayerMatchRatingsController {
  constructor(private readonly matches: Matches) {}

  @Get()
  @Can('team.results.read', { teamParam: 'teamId' })
  list(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('playerId') playerId: string,
  ): Promise<PlayerMatchRatingsResponse> {
    return this.matches.playerRatings(actor, teamId, parseInput(z.uuid(), playerId));
  }
}
