import { Body, Controller, Delete, HttpCode, Param, Post } from '@nestjs/common';
import {
  CreateKnowledgeReviewRequestSchema,
  type KnowledgeReviewResponse,
  VoidExamRequestSchema,
} from '@sdl/contracts';
import { z } from 'zod';

import { Can } from '../../../shared/authz/can.decorator.js';
import { CurrentActor } from '../../../shared/authz/current-actor.decorator.js';
import type { Actor } from '../../../shared/authz/policy.js';
import { parseInput } from '../../../shared/http/validation.js';
import { KnowledgeStaff } from '../application/knowledge-staff.use-cases.js';

const Uuid = z.uuid();

@Controller('teams/:teamId')
export class KnowledgeStaffController {
  constructor(private readonly staff: KnowledgeStaff) {}

  @Post('cert-exams/:examId/void')
  @Can('team.attempts.void', { teamParam: 'teamId' })
  @HttpCode(204)
  async voidExam(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('examId') examId: string,
    @Body() body: unknown,
  ): Promise<void> {
    await this.staff.voidExam(
      actor,
      teamId,
      parseInput(Uuid, examId),
      parseInput(VoidExamRequestSchema, body),
    );
  }

  @Post('players/:playerId/knowledge-reviews')
  @Can('team.reevaluations.request', { teamParam: 'teamId' })
  async requestReview(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('playerId') playerId: string,
    @Body() body: unknown,
  ): Promise<KnowledgeReviewResponse> {
    const review = await this.staff.requestReview(
      actor,
      teamId,
      parseInput(Uuid, playerId),
      parseInput(CreateKnowledgeReviewRequestSchema, body),
    );
    return { review };
  }

  @Delete('knowledge-reviews/:reviewId')
  @Can('team.reevaluations.request', { teamParam: 'teamId' })
  @HttpCode(204)
  async cancelReview(
    @CurrentActor() actor: Actor,
    @Param('teamId') teamId: string,
    @Param('reviewId') reviewId: string,
  ): Promise<void> {
    await this.staff.cancelReview(actor, teamId, parseInput(Uuid, reviewId));
  }
}
