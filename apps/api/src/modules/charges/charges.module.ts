import { Module } from '@nestjs/common';

import { Charges } from './application/charges.use-cases.js';
import { CHARGES_REPOSITORY } from './application/ports/charges.repository.js';
import { ChargesController, MyChargesController } from './http/charges.controller.js';
import { DrizzleChargesRepository } from './infrastructure/drizzle-charges.repository.js';

/** Cobros del equipo (`06` Cobros): quién debe, quién pagó y los "Ya pagué". */
@Module({
  controllers: [ChargesController, MyChargesController],
  providers: [
    DrizzleChargesRepository,
    { provide: CHARGES_REPOSITORY, useExisting: DrizzleChargesRepository },
    Charges,
  ],
})
export class ChargesModule {}
