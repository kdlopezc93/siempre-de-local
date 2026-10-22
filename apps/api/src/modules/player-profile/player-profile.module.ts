import { Global, Module } from '@nestjs/common';

import { PROFILE_QUERY } from '../identity/application/ports/profile.query.js';
import { PROFILES_QUERY } from '../squad/application/ports/squad.ports.js';
import { PROFILE_REPOSITORY } from './application/ports/profile.repository.js';
import { PlayerProfiles } from './application/profile.use-cases.js';
import { ProfileController } from './http/profile.controller.js';
import { DrizzleProfileRepository } from './infrastructure/drizzle-profile.repository.js';

/** Perfil propio del jugador. Global porque identity lo lee para `/me`. */
@Global()
@Module({
  controllers: [ProfileController],
  providers: [
    { provide: PROFILE_REPOSITORY, useClass: DrizzleProfileRepository },
    PlayerProfiles,
    { provide: PROFILE_QUERY, useExisting: PlayerProfiles },
    { provide: PROFILES_QUERY, useExisting: PlayerProfiles },
  ],
  exports: [PROFILE_QUERY, PROFILES_QUERY],
})
export class PlayerProfileModule {}
