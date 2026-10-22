import { Module } from '@nestjs/common';

import { AssessmentsModule } from '../assessments/assessments.module.js';
import { QuizModule } from '../quiz/quiz.module.js';
import { RatingsModule } from '../ratings/ratings.module.js';
import { GetPlayerProfile } from './application/get-player-profile.use-case.js';
import { GetSquad } from './application/get-squad.use-case.js';
import { SquadController } from './http/squad.controller.js';

/** Panel de la plantilla para el cuerpo técnico: lee de varios módulos por sus puertos. */
@Module({
  imports: [QuizModule, AssessmentsModule, RatingsModule],
  controllers: [SquadController],
  providers: [GetSquad, GetPlayerProfile],
  exports: [GetSquad],
})
export class SquadModule {}
