import { Module } from '@nestjs/common';

import { MatchesModule } from '../matches/matches.module.js';
import { Lineups } from './application/lineups.use-cases.js';
import { LINEUPS_REPOSITORY } from './application/ports/lineups.repository.js';
import { LineupsController } from './http/lineups.controller.js';
import { DrizzleLineupsRepository } from './infrastructure/drizzle-lineups.repository.js';

/** Alineaciones guardadas del planificador (docs/02 §9). */
@Module({
  imports: [MatchesModule],
  controllers: [LineupsController],
  providers: [{ provide: LINEUPS_REPOSITORY, useClass: DrizzleLineupsRepository }, Lineups],
})
export class LineupsModule {}
