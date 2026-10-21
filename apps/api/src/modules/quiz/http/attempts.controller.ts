import { Body, Controller, Get, Param, Post, Res } from '@nestjs/common';
import {
  type AttemptListResponse,
  type AttemptResult,
  SubmitAttemptRequestSchema,
} from '@sdl/contracts';
import type { FastifyReply } from 'fastify';
import { z } from 'zod';

import { CurrentSession } from '../../../shared/authz/current-session.decorator.js';
import { parseInput } from '../../../shared/http/validation.js';
import type { AuthSession } from '../../identity/application/ports/identity-provider.port.js';
import { MyAttempts, SubmitAttempt } from '../application/attempts.use-cases.js';

const UUID = z.uuid();

@Controller()
export class AttemptsController {
  constructor(
    private readonly submitAttempt: SubmitAttempt,
    private readonly myAttempts: MyAttempts,
  ) {}

  /** 201 la primera vez; 200 con el mismo resultado si la cola lo reenvía. */
  @Post('attempts')
  async submit(
    @CurrentSession() session: AuthSession,
    @Body() body: unknown,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<AttemptResult> {
    const request = parseInput(SubmitAttemptRequestSchema, body);
    const { result, created } = await this.submitAttempt.execute(session.user.id, request);
    void reply.status(created ? 201 : 200);
    return result;
  }

  @Get('me/attempts')
  async mine(@CurrentSession() session: AuthSession): Promise<AttemptListResponse> {
    return { items: await this.myAttempts.list(session.user.id) };
  }

  @Get('attempts/:attemptId')
  one(
    @CurrentSession() session: AuthSession,
    @Param('attemptId') attemptId: string,
  ): Promise<AttemptResult> {
    return this.myAttempts.get(session.user.id, parseInput(UUID, attemptId));
  }
}
