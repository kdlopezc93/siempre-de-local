import { Module } from '@nestjs/common';

import { RATINGS_REPOSITORY } from './application/ports/ratings.repository.js';
import { MyCard, PlayerRatings } from './application/ratings.use-cases.js';
import { CardController, PlayerRatingsController } from './http/ratings.controller.js';
import { DrizzleRatingsRepository } from './infrastructure/drizzle-ratings.repository.js';

/** Tarjeta 0–99 del jugador (docs/02 §7). */
@Module({
  controllers: [PlayerRatingsController, CardController],
  providers: [
    { provide: RATINGS_REPOSITORY, useClass: DrizzleRatingsRepository },
    PlayerRatings,
    MyCard,
  ],
  exports: [RATINGS_REPOSITORY],
})
export class RatingsModule {}
