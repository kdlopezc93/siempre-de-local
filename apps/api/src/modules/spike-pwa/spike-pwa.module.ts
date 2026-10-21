import { Module } from '@nestjs/common';

import { SpikeAttempts } from './application/spike-attempts.service.js';
import { SpikePwaController } from './http/spike-pwa.controller.js';

/** TEMPORAL · spike PWA de Fase 0 (docs/spikes/pwa.md). Se borra en Fase 3. */
@Module({ controllers: [SpikePwaController], providers: [SpikeAttempts] })
export class SpikePwaModule {}
