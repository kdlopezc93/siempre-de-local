import { Module } from '@nestjs/common';

import { QuizModule } from '../quiz/quiz.module.js';
import { GetAdoption } from './application/adoption.use-case.js';
import { ADOPTION_REPOSITORY } from './application/ports/adoption.ports.js';
import { AdoptionController } from './http/adoption.controller.js';
import { DrizzleAdoptionRepository } from './infrastructure/drizzle-adoption.repository.js';

/** La app en el equipo (2026-11-06): lee sesiones, avisos, tests y respuestas por su puerto. */
@Module({
  imports: [QuizModule],
  controllers: [AdoptionController],
  providers: [GetAdoption, { provide: ADOPTION_REPOSITORY, useClass: DrizzleAdoptionRepository }],
})
export class AdoptionModule {}
