import { Module } from '@nestjs/common';

import { QuestionnairesModule } from '../questionnaires/questionnaires.module.js';
import { MyAttempts, SubmitAttempt } from './application/attempts.use-cases.js';
import { ATTEMPTS_REPOSITORY } from './application/ports/attempts.repository.js';
import { AttemptsController } from './http/attempts.controller.js';
import { DrizzleAttemptsRepository } from './infrastructure/drizzle-attempts.repository.js';

/** Test de orientación: intentos, puntuación oficial e historial (docs/02 §3–5). */
@Module({
  imports: [QuestionnairesModule],
  controllers: [AttemptsController],
  providers: [
    { provide: ATTEMPTS_REPOSITORY, useClass: DrizzleAttemptsRepository },
    SubmitAttempt,
    MyAttempts,
  ],
})
export class QuizModule {}
