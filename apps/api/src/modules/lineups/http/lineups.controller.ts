import { Body, Controller, Delete, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import {
  LineupInputSchema,
  type LineupListResponse,
  type LineupResponse,
  type PublishedLineupResponse,
} from '@sdl/contracts';
import { z } from 'zod';

import { Can } from '../../../shared/authz/can.decorator.js';
import { CurrentActor } from '../../../shared/authz/current-actor.decorator.js';
import type { Actor } from '../../../shared/authz/policy.js';
import { parseInput } from '../../../shared/http/validation.js';
import { Lineups } from '../application/lineups.use-cases.js';

const Uuid = z.uuid();

@Controller('teams/:teamId/lineups')
export class LineupsController {
  constructor(private readonly lineups: Lineups) {}

  @Post()
  @Can('team.lineups.write', { teamParam: 'teamId' })
  async create(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Body() body: unknown,
  ): Promise<LineupResponse> {
    return {
      lineup: await this.lineups.create(actor, teamId, parseInput(LineupInputSchema, body)),
    };
  }

  @Get()
  @Can('team.results.read', { teamParam: 'teamId' })
  async list(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
  ): Promise<LineupListResponse> {
    const items = await this.lineups.list(actor, teamId);
    return {
      items: items.map(({ id, name, matchDate, matchId, formation, createdBy, updatedAt }) => ({
        id,
        name,
        matchDate,
        matchId,
        formation,
        createdBy,
        updatedAt,
      })),
    };
  }

  @Get(':lineupId')
  @Can('team.results.read', { teamParam: 'teamId' })
  async get(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('lineupId') lineupId: string,
  ): Promise<LineupResponse> {
    return { lineup: await this.lineups.get(actor, teamId, parseInput(Uuid, lineupId)) };
  }

  @Put(':lineupId')
  @Can('team.lineups.write', { teamParam: 'teamId' })
  async update(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('lineupId') lineupId: string,
    @Body() body: unknown,
  ): Promise<LineupResponse> {
    return {
      lineup: await this.lineups.update(
        actor,
        teamId,
        parseInput(Uuid, lineupId),
        parseInput(LineupInputSchema, body),
      ),
    };
  }

  @Delete(':lineupId')
  @Can('team.lineups.write', { teamParam: 'teamId' })
  @HttpCode(204)
  async remove(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('lineupId') lineupId: string,
  ): Promise<void> {
    await this.lineups.remove(actor, teamId, parseInput(Uuid, lineupId));
  }

  /** Publicar (o republicar) la alineación de un partido para todo el equipo (D17). */
  @Post(':lineupId/publish')
  @Can('team.matches.write', { teamParam: 'teamId' })
  @HttpCode(204)
  async publish(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('lineupId') lineupId: string,
  ): Promise<void> {
    await this.lineups.publish(actor, teamId, parseInput(z.uuid(), lineupId));
  }
}

/** La alineación publicada de un partido, para todo el equipo (Fase 7, D17). */
@Controller('teams/:teamId/matches/:matchId/lineup')
export class PublishedLineupController {
  constructor(private readonly lineups: Lineups) {}

  @Get()
  @Can('team.read', { teamParam: 'teamId' })
  get(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('matchId') matchId: string,
  ): Promise<PublishedLineupResponse> {
    return this.lineups.published(actor, teamId, parseInput(z.uuid(), matchId));
  }
}
