import { Module } from '@nestjs/common';

import { ConfigModule } from './config/config.module.js';
import { HealthModule } from './modules/health/health.module.js';
import { DbModule } from './shared/db/db.module.js';

@Module({
  imports: [ConfigModule, DbModule, HealthModule],
})
export class AppModule {}
