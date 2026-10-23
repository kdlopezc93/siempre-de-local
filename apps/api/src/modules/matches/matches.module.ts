import { Module } from '@nestjs/common';

import { MATCHES_REPOSITORY } from './application/ports/matches.repository.js';
import { Matches } from './application/matches.use-cases.js';
import { MatchesController } from './http/matches.controller.js';
import { DrizzleMatchesRepository } from './infrastructure/drizzle-matches.repository.js';

/** Partidos: convocatoria y respuestas (Fase 7). */
@Module({
  controllers: [MatchesController],
  providers: [{ provide: MATCHES_REPOSITORY, useClass: DrizzleMatchesRepository }, Matches],
})
export class MatchesModule {}
