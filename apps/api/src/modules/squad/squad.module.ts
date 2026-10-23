import { Module } from '@nestjs/common';

import { AssessmentsModule } from '../assessments/assessments.module.js';
import { CertificationModule } from '../certification/certification.module.js';
import { QuizModule } from '../quiz/quiz.module.js';
import { RatingsModule } from '../ratings/ratings.module.js';
import { GetLineupInputs } from './application/get-lineup-inputs.use-case.js';
import { GetPlayerProfile } from './application/get-player-profile.use-case.js';
import { GetTeamMembers } from './application/get-team-members.use-case.js';
import { GetSquad } from './application/get-squad.use-case.js';
import { GetValidation } from './application/get-validation.use-case.js';
import { SquadController } from './http/squad.controller.js';

/** Panel de la plantilla para el cuerpo técnico: lee de varios módulos por sus puertos. */
@Module({
  imports: [QuizModule, AssessmentsModule, RatingsModule, CertificationModule],
  controllers: [SquadController],
  providers: [GetSquad, GetPlayerProfile, GetLineupInputs, GetValidation, GetTeamMembers],
  exports: [GetSquad],
})
export class SquadModule {}
