import { Global, Module } from '@nestjs/common';

import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.js';
import type { DbConnection } from '../../shared/db/client.js';
import { DB_CONNECTION } from '../../shared/db/db.module.js';
import { GetCurrentUser } from './application/get-current-user.use-case.js';
import { IDENTITY_PROVIDER } from './application/ports/identity-provider.port.js';
import { createAuth, type Auth } from './infrastructure/better-auth.js';
import { BetterAuthIdentityProvider } from './infrastructure/better-auth.adapter.js';
import { BETTER_AUTH, BetterAuthRoutes } from './infrastructure/better-auth.routes.js';
import { MeController } from './http/me.controller.js';

@Global()
@Module({
  controllers: [MeController],
  providers: [
    {
      provide: BETTER_AUTH,
      inject: [ENV, DB_CONNECTION],
      useFactory: (env: Env, connection: DbConnection): Auth => createAuth(env, connection.db),
    },
    {
      provide: IDENTITY_PROVIDER,
      inject: [BETTER_AUTH],
      useFactory: (auth: Auth) => new BetterAuthIdentityProvider(auth),
    },
    BetterAuthRoutes,
    GetCurrentUser,
  ],
  exports: [IDENTITY_PROVIDER],
})
export class IdentityModule {}
