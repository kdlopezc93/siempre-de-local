import { Module } from '@nestjs/common';

import { MATCHES_REPOSITORY } from './application/ports/matches.repository.js';
import { MATCH_GATEWAY } from '../lineups/application/ports/match-gateway.port.js';
import { Matches } from './application/matches.use-cases.js';
import { MatchesController } from './http/matches.controller.js';
import { DrizzleMatchesRepository } from './infrastructure/drizzle-matches.repository.js';

/** Partidos: convocatoria y respuestas (Fase 7). */
@Module({
  controllers: [MatchesController],
  providers: [
    DrizzleMatchesRepository,
    { provide: MATCHES_REPOSITORY, useExisting: DrizzleMatchesRepository },
    { provide: MATCH_GATEWAY, useExisting: DrizzleMatchesRepository },
    Matches,
  ],
  exports: [MATCH_GATEWAY],
})
export class MatchesModule {}
