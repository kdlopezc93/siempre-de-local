import { Body, Controller, Get, Param, Post, Query } from '@nestjs/common';
import {
  type AssessmentListResponse,
  type AssessmentResponse,
  CreateAssessmentRequestSchema,
} from '@sdl/contracts';
import { z } from 'zod';

import { Can } from '../../../shared/authz/can.decorator.js';
import { CurrentActor } from '../../../shared/authz/current-actor.decorator.js';
import type { Actor } from '../../../shared/authz/policy.js';
import { parseInput } from '../../../shared/http/validation.js';
import { CoachAssessments } from '../application/assessments.use-cases.js';

const PlayerFilterSchema = z.uuid().optional();

@Controller('teams/:teamId/assessments')
export class AssessmentsController {
  constructor(private readonly assessments: CoachAssessments) {}

  @Post()
  @Can('team.assessments.write', { teamParam: 'teamId' })
  async create(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Body() body: unknown,
  ): Promise<AssessmentResponse> {
    const request = parseInput(CreateAssessmentRequestSchema, body);
    return { assessment: await this.assessments.create(actor, teamId, request) };
  }

  @Get()
  @Can('team.results.read', { teamParam: 'teamId' })
  async list(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Query('playerId') playerId: string | undefined,
  ): Promise<AssessmentListResponse> {
    const player = parseInput(PlayerFilterSchema, playerId);
    return { items: await this.assessments.list(actor, teamId, player) };
  }
}
