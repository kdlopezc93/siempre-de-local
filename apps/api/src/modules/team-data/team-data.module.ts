import { Module } from '@nestjs/common';

import { RatingsModule } from '../ratings/ratings.module.js';
import { SquadModule } from '../squad/squad.module.js';
import { LEGACY_RESULTS_REPOSITORY } from './application/ports/legacy-results.repository.js';
import { ExportTeam, LegacyResults } from './application/team-data.use-cases.js';
import { TeamDataController } from './http/team-data.controller.js';
import { DrizzleLegacyResultsRepository } from './infrastructure/drizzle-legacy-results.repository.js';

/** Sacar y meter datos del equipo: exportar la plantilla e importar CSV del prototipo. */
@Module({
  imports: [SquadModule, RatingsModule],
  controllers: [TeamDataController],
  providers: [
    { provide: LEGACY_RESULTS_REPOSITORY, useClass: DrizzleLegacyResultsRepository },
    ExportTeam,
    LegacyResults,
  ],
})
export class TeamDataModule {}
