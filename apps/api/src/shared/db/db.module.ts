import { Global, Inject, Module, type OnApplicationShutdown } from '@nestjs/common';

import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.js';
import { createDb, type DbConnection } from './client.js';

export const DB_CONNECTION = Symbol('DB_CONNECTION');

@Global()
@Module({
  providers: [
    {
      provide: DB_CONNECTION,
      inject: [ENV],
      useFactory: (env: Env): DbConnection => createDb(env.DATABASE_URL),
    },
  ],
  exports: [DB_CONNECTION],
})
export class DbModule implements OnApplicationShutdown {
  constructor(@Inject(DB_CONNECTION) private readonly connection: DbConnection) {}

  async onApplicationShutdown(): Promise<void> {
    await this.connection.pool.end();
  }
}
