import { Module } from '@nestjs/common';

import { RatingsModule } from '../ratings/ratings.module.js';
import { SquadModule } from '../squad/squad.module.js';
import { ExportTeam } from './application/team-data.use-cases.js';
import { TeamDataController } from './http/team-data.controller.js';

/** Sacar los datos del equipo: la plantilla en CSV. */
@Module({
  imports: [SquadModule, RatingsModule],
  controllers: [TeamDataController],
  providers: [ExportTeam],
})
export class TeamDataModule {}
