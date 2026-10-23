import { Global, Module } from '@nestjs/common';

import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.js';
import { NOTIFIER } from '../../shared/notifications/notifier.port.js';
import { Notifications } from './application/notifications.use-cases.js';
import { PUSH_SENDER, SUBSCRIPTIONS_REPOSITORY } from './application/ports/push.ports.js';
import { NotificationsController } from './http/notifications.controller.js';
import { DrizzleSubscriptionsRepository } from './infrastructure/drizzle-subscriptions.repository.js';
import { WebPushSender } from './infrastructure/web-push.sender.js';

/** Avisos por Web Push. Global: partidos y alineaciones avisan por NOTIFIER. */
@Global()
@Module({
  controllers: [NotificationsController],
  providers: [
    { provide: SUBSCRIPTIONS_REPOSITORY, useClass: DrizzleSubscriptionsRepository },
    {
      provide: PUSH_SENDER,
      useFactory: (env: Env) =>
        new WebPushSender({
          ...(env.VAPID_PUBLIC_KEY ? { publicKey: env.VAPID_PUBLIC_KEY } : {}),
          ...(env.VAPID_PRIVATE_KEY ? { privateKey: env.VAPID_PRIVATE_KEY } : {}),
          ...(env.VAPID_SUBJECT ? { subject: env.VAPID_SUBJECT } : {}),
        }),
      inject: [ENV],
    },
    Notifications,
    { provide: NOTIFIER, useExisting: Notifications },
  ],
  exports: [NOTIFIER],
})
export class NotificationsModule {}
