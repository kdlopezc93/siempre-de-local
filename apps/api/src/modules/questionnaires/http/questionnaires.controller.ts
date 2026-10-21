import { Controller, Get, Headers, HttpStatus, Res } from '@nestjs/common';
import type { QuestionnaireResponse } from '@sdl/contracts';
import type { FastifyReply } from 'fastify';

import { GetCurrentQuestionnaire } from '../application/get-current-questionnaire.use-case.js';

@Controller('questionnaires')
export class QuestionnairesController {
  constructor(private readonly getCurrent: GetCurrentQuestionnaire) {}

  /** Con ETag = id de la versión (inmutable): el service worker revalida con un 304. */
  @Get('current')
  async current(
    @Headers('if-none-match') ifNoneMatch: string | undefined,
    @Res({ passthrough: true }) reply: FastifyReply,
  ): Promise<QuestionnaireResponse | undefined> {
    const questionnaire = await this.getCurrent.execute();
    const etag = `"${questionnaire.versionId}"`;
    void reply.header('etag', etag).header('cache-control', 'private, no-cache');
    if (ifNoneMatch === etag) {
      void reply.status(HttpStatus.NOT_MODIFIED);
      return undefined;
    }
    return questionnaire;
  }
}
