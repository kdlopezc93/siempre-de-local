import { Module } from '@nestjs/common';

import { CoachAssessments } from './application/assessments.use-cases.js';
import { ASSESSMENTS_REPOSITORY } from './application/ports/assessments.repository.js';
import { AssessmentsController } from './http/assessments.controller.js';
import { DrizzleAssessmentsRepository } from './infrastructure/drizzle-assessments.repository.js';

/** Valoraciones del cuerpo técnico (docs/02 §9.1 · V, §11). */
@Module({
  controllers: [AssessmentsController],
  providers: [
    { provide: ASSESSMENTS_REPOSITORY, useClass: DrizzleAssessmentsRepository },
    CoachAssessments,
  ],
  exports: [ASSESSMENTS_REPOSITORY],
})
export class AssessmentsModule {}
