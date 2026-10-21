import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { ConfigModule } from './config/config.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { SpikePwaModule } from './modules/spike-pwa/spike-pwa.module.js';
import { SessionGuard } from './shared/authz/session.guard.js';
import { DbModule } from './shared/db/db.module.js';

@Module({
  imports: [ConfigModule, DbModule, IdentityModule, HealthModule, SpikePwaModule],
  providers: [{ provide: APP_GUARD, useClass: SessionGuard }],
})
export class AppModule {}
