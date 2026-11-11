import { Module } from '@nestjs/common';

import { MATCHES_REPOSITORY } from './application/ports/matches.repository.js';
import { MATCH_GATEWAY } from '../lineups/application/ports/match-gateway.port.js';
import { OPEN_MATCHES_QUERY } from '../teams/application/ports/open-matches.query.js';
import { Matches } from './application/matches.use-cases.js';
import {
  MatchesController,
  MatchesCronController,
  PlayerMatchRatingsController,
  ScorersController,
  TournamentsController,
} from './http/matches.controller.js';
import { DrizzleMatchesRepository } from './infrastructure/drizzle-matches.repository.js';

/** Partidos: convocatoria, respuestas y después del partido (Fase 7). */
@Module({
  controllers: [
    MatchesController,
    MatchesCronController,
    PlayerMatchRatingsController,
    ScorersController,
    TournamentsController,
  ],
  providers: [
    DrizzleMatchesRepository,
    { provide: MATCHES_REPOSITORY, useExisting: DrizzleMatchesRepository },
    { provide: MATCH_GATEWAY, useExisting: DrizzleMatchesRepository },
    { provide: OPEN_MATCHES_QUERY, useExisting: DrizzleMatchesRepository },
    Matches,
  ],
  // Matches: el acudiente responde la convocatoria por su hijo (families, 2026-11-10).
  exports: [MATCH_GATEWAY, OPEN_MATCHES_QUERY, Matches],
})
export class MatchesModule {}
