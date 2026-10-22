import { Module } from '@nestjs/common';

import { QuestionnairesModule } from '../questionnaires/questionnaires.module.js';
import { MyAttempts, SubmitAttempt } from './application/attempts.use-cases.js';
import { ATTEMPTS_REPOSITORY } from './application/ports/attempts.repository.js';
import { LATEST_RESULTS_QUERY } from '../squad/application/ports/squad.ports.js';
import { AttemptsController } from './http/attempts.controller.js';
import { DrizzleAttemptsRepository } from './infrastructure/drizzle-attempts.repository.js';

/** Test de orientación: intentos, puntuación oficial e historial (docs/02 §3–5). */
@Module({
  imports: [QuestionnairesModule],
  controllers: [AttemptsController],
  providers: [
    DrizzleAttemptsRepository,
    { provide: ATTEMPTS_REPOSITORY, useExisting: DrizzleAttemptsRepository },
    { provide: LATEST_RESULTS_QUERY, useExisting: DrizzleAttemptsRepository },
    SubmitAttempt,
    MyAttempts,
  ],
  exports: [LATEST_RESULTS_QUERY],
})
export class QuizModule {}
