import { Global, Module } from '@nestjs/common';
import { ThrottlerModule } from '@nestjs/throttler';

import { CHILDREN_QUERY } from '../identity/application/ports/children.query.js';
import { FAMILIES_REPOSITORY } from './application/ports/families.repository.js';
import { RegisterMinor } from './application/register-minor.use-case.js';
import { FamiliesController } from './http/families.controller.js';
import { DrizzleFamiliesRepository } from './infrastructure/drizzle-families.repository.js';

/**
 * Menores y acudientes (escuelas, 2026-11-08, `08` §10). Global porque identity (`/me`) lee los
 * hijos del acudiente.
 */
@Global()
@Module({
  imports: [
    // Como las invitaciones de TeamsModule: corta la fuerza bruta sobre los códigos (04 §1.2).
    ThrottlerModule.forRoot({
      throttlers: [{ ttl: 60_000, limit: 20 }],
      errorMessage: 'Demasiados intentos seguidos. Espera un minuto y vuelve a intentar.',
    }),
  ],
  controllers: [FamiliesController],
  providers: [
    DrizzleFamiliesRepository,
    { provide: FAMILIES_REPOSITORY, useExisting: DrizzleFamiliesRepository },
    { provide: CHILDREN_QUERY, useExisting: DrizzleFamiliesRepository },
    RegisterMinor,
  ],
  exports: [CHILDREN_QUERY],
})
export class FamiliesModule {}
