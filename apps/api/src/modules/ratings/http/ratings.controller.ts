import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  CreateRatingRequestSchema,
  type MyCardResponse,
  type RatingAttributesResponse,
  type RatingHistoryResponse,
  type RatingResponse,
} from '@sdl/contracts';
import { z } from 'zod';

import { Can } from '../../../shared/authz/can.decorator.js';
import { CurrentActor } from '../../../shared/authz/current-actor.decorator.js';
import { CurrentSession } from '../../../shared/authz/current-session.decorator.js';
import type { Actor } from '../../../shared/authz/policy.js';
import { parseInput } from '../../../shared/http/validation.js';
import type { AuthSession } from '../../identity/application/ports/identity-provider.port.js';
import { MyCard, PlayerRatings, ratingCatalog } from '../application/ratings.use-cases.js';

const Uuid = z.uuid();

@Controller('teams/:teamId/players/:playerId/ratings')
export class PlayerRatingsController {
  constructor(private readonly ratings: PlayerRatings) {}

  @Post()
  @Can('team.ratings.write', { teamParam: 'teamId' })
  async create(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('playerId') playerId: string,
    @Body() body: unknown,
  ): Promise<RatingResponse> {
    const request = parseInput(CreateRatingRequestSchema, body);
    const player = parseInput(Uuid, playerId);
    return { rating: await this.ratings.create(actor, teamId, player, request) };
  }

  @Get()
  @Can('team.results.read', { teamParam: 'teamId' })
  async history(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('playerId') playerId: string,
  ): Promise<RatingHistoryResponse> {
    const player = parseInput(Uuid, playerId);
    return { items: await this.ratings.history(actor, teamId, player) };
  }
}

@Controller()
export class CardController {
  constructor(private readonly card: MyCard) {}

  @Get('me/card')
  myCard(
    @CurrentSession() session: AuthSession,
    @Query('teamId') teamId: string | undefined,
  ): Promise<MyCardResponse> {
    return this.card.get(session.user.id, parseInput(Uuid, teamId));
  }

  @Get('rating-attributes')
  catalog(): RatingAttributesResponse {
    return ratingCatalog();
  }
}
