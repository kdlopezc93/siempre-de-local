import { Module } from '@nestjs/common';
import { APP_GUARD } from '@nestjs/core';

import { ConfigModule } from './config/config.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { IdentityModule } from './modules/identity/identity.module.js';
import { SpikePwaModule } from './modules/spike-pwa/spike-pwa.module.js';
import { TeamsModule } from './modules/teams/teams.module.js';
import { PermissionGuard } from './shared/authz/permission.guard.js';
import { SessionGuard } from './shared/authz/session.guard.js';
import { DbModule } from './shared/db/db.module.js';

@Module({
  imports: [ConfigModule, DbModule, IdentityModule, TeamsModule, HealthModule, SpikePwaModule],
  // En este orden: primero la sesión, después los permisos de @Can.
  providers: [
    { provide: APP_GUARD, useClass: SessionGuard },
    { provide: APP_GUARD, useClass: PermissionGuard },
  ],
})
export class AppModule {}
