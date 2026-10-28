import { Module } from '@nestjs/common';

import { MATCHES_REPOSITORY } from './application/ports/matches.repository.js';
import { MATCH_GATEWAY } from '../lineups/application/ports/match-gateway.port.js';
import { OPEN_MATCHES_QUERY } from '../teams/application/ports/open-matches.query.js';
import { Matches } from './application/matches.use-cases.js';
import {
  MatchesController,
  PlayerMatchRatingsController,
  TournamentsController,
} from './http/matches.controller.js';
import { DrizzleMatchesRepository } from './infrastructure/drizzle-matches.repository.js';

/** Partidos: convocatoria, respuestas y después del partido (Fase 7). */
@Module({
  controllers: [MatchesController, PlayerMatchRatingsController, TournamentsController],
  providers: [
    DrizzleMatchesRepository,
    { provide: MATCHES_REPOSITORY, useExisting: DrizzleMatchesRepository },
    { provide: MATCH_GATEWAY, useExisting: DrizzleMatchesRepository },
    { provide: OPEN_MATCHES_QUERY, useExisting: DrizzleMatchesRepository },
    Matches,
  ],
  exports: [MATCH_GATEWAY, OPEN_MATCHES_QUERY],
})
export class MatchesModule {}
