import { Module } from '@nestjs/common';

import { MATCHES_REPOSITORY } from './application/ports/matches.repository.js';
import { MATCH_GATEWAY } from '../lineups/application/ports/match-gateway.port.js';
import { Matches } from './application/matches.use-cases.js';
import { MatchesController, PlayerMatchRatingsController } from './http/matches.controller.js';
import { DrizzleMatchesRepository } from './infrastructure/drizzle-matches.repository.js';

/** Partidos: convocatoria, respuestas y después del partido (Fase 7). */
@Module({
  controllers: [MatchesController, PlayerMatchRatingsController],
  providers: [
    DrizzleMatchesRepository,
    { provide: MATCHES_REPOSITORY, useExisting: DrizzleMatchesRepository },
    { provide: MATCH_GATEWAY, useExisting: DrizzleMatchesRepository },
    Matches,
  ],
  exports: [MATCH_GATEWAY],
})
export class MatchesModule {}
