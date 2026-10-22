import { Body, Controller, Get, HttpCode, Param, Post, Put } from '@nestjs/common';
import {
  AnswerRequestSchema,
  type CertPositionsResponse,
  type ExamInProgress,
  type ExamResponse,
  type ExamResult,
  type MyExamsResponse,
  StartExamRequestSchema,
} from '@sdl/contracts';
import { z } from 'zod';

import { CurrentSession } from '../../../shared/authz/current-session.decorator.js';
import { parseInput } from '../../../shared/http/validation.js';
import type { AuthSession } from '../../identity/application/ports/identity-provider.port.js';
import { CertExams } from '../application/cert-exams.use-cases.js';

const Uuid = z.uuid();

@Controller()
export class CertExamsController {
  constructor(private readonly exams: CertExams) {}

  @Get('certification/positions')
  positions(@CurrentSession() session: AuthSession): Promise<CertPositionsResponse> {
    return this.exams.positions(session.user.id);
  }

  @Post('cert-exams')
  start(@CurrentSession() session: AuthSession, @Body() body: unknown): Promise<ExamInProgress> {
    return this.exams.start(session.user.id, parseInput(StartExamRequestSchema, body));
  }

  @Get('cert-exams/:examId')
  get(
    @CurrentSession() session: AuthSession,
    @Param('examId') examId: string,
  ): Promise<ExamResponse> {
    return this.exams.get(session.user.id, parseInput(Uuid, examId));
  }

  @Put('cert-exams/:examId/answers/:itemId')
  @HttpCode(204)
  async answer(
    @CurrentSession() session: AuthSession,
    @Param('examId') examId: string,
    @Param('itemId') itemId: string,
    @Body() body: unknown,
  ): Promise<void> {
    const { optionId } = parseInput(AnswerRequestSchema, body);
    await this.exams.answer(
      session.user.id,
      parseInput(Uuid, examId),
      parseInput(Uuid, itemId),
      optionId,
    );
  }

  @Post('cert-exams/:examId/submit')
  @HttpCode(200)
  submit(
    @CurrentSession() session: AuthSession,
    @Param('examId') examId: string,
  ): Promise<ExamResult> {
    return this.exams.submit(session.user.id, parseInput(Uuid, examId));
  }

  @Post('cert-exams/:examId/abandon')
  @HttpCode(200)
  abandon(
    @CurrentSession() session: AuthSession,
    @Param('examId') examId: string,
  ): Promise<ExamResult> {
    return this.exams.abandon(session.user.id, parseInput(Uuid, examId));
  }

  @Get('me/cert-exams')
  async mine(@CurrentSession() session: AuthSession): Promise<MyExamsResponse> {
    return { items: await this.exams.myExams(session.user.id) };
  }
}
