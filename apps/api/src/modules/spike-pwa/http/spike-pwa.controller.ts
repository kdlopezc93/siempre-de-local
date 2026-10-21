import {
  BadRequestException,
  Body,
  Controller,
  Get,
  Headers,
  HttpStatus,
  Post,
  Res,
} from '@nestjs/common';
import {
  SpikeAttemptRequestSchema,
  type SpikeAttemptResponse,
  type SpikeQuestionnaire,
} from '@sdl/contracts';
import type { FastifyReply } from 'fastify';

import type { AuthSession } from '../../identity/application/ports/identity-provider.port.js';
import { CurrentSession } from '../../../shared/authz/current-session.decorator.js';
import { SpikeAttempts } from '../application/spike-attempts.service.js';
import {
  SPIKE_QUESTIONNAIRE,
  SPIKE_QUESTIONNAIRE_ETAG,
} from '../application/spike-questionnaire.js';

@Controller('spike')
export class SpikePwaController {
  constructor(private readonly attempts: SpikeAttempts) {}

  @Get('questionnaire')
  questionnaire(
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): SpikeQuestionnaire | undefined {
    // no-cache: el navegador puede guardarlo, pero revalida siempre con el ETag.
    void reply
      .header('etag', SPIKE_QUESTIONNAIRE_ETAG)
      .header('cache-control', 'private, no-cache');
    if (ifNoneMatch === SPIKE_QUESTIONNAIRE_ETAG) {
      void reply.status(HttpStatus.NOT_MODIFIED);
      return undefined;
    }
    return SPIKE_QUESTIONNAIRE;
  }

  @Post('attempts')
  submit(
    @CurrentSession() session: AuthSession,
    @Body() body: unknown,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): SpikeAttemptResponse {
    const parsed = SpikeAttemptRequestSchema.safeParse(body);
    if (!parsed.success) throw new BadRequestException('Intento inválido');

    const { attempt, created } = this.attempts.receive(session.user.id, parsed.data);
    void reply.status(created ? HttpStatus.CREATED : HttpStatus.OK);
    return attempt;
  }
}
