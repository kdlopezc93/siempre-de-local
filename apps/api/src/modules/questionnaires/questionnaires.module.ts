import { Module } from '@nestjs/common';

import { GetCurrentQuestionnaire } from './application/get-current-questionnaire.use-case.js';
import { QUESTIONNAIRE_READER } from './application/ports/questionnaire.reader.js';
import { QuestionnairesController } from './http/questionnaires.controller.js';
import { DrizzleQuestionnaireReader } from './infrastructure/drizzle-questionnaire.reader.js';

@Module({
  controllers: [QuestionnairesController],
  providers: [
    { provide: QUESTIONNAIRE_READER, useClass: DrizzleQuestionnaireReader },
    GetCurrentQuestionnaire,
  ],
  exports: [QUESTIONNAIRE_READER],
})
export class QuestionnairesModule {}
