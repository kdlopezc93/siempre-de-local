import { Inject, Injectable, Logger } from '@nestjs/common';

import type { Notifier, PushMessage } from '../../../shared/notifications/notifier.port.js';
import {
  PUSH_SENDER,
  type PushSender,
  type StoredSubscription,
  SUBSCRIPTIONS_REPOSITORY,
  type SubscriptionsRepository,
} from './ports/push.ports.js';

/** Avisos por Web Push (Fase 7, D16): suscribirse, desuscribirse y avisar. */
@Injectable()
export class Notifications implements Notifier {
  private readonly logger = new Logger(Notifications.name);

  constructor(
    @Inject(SUBSCRIPTIONS_REPOSITORY) private readonly subscriptions: SubscriptionsRepository,
    @Inject(PUSH_SENDER) private readonly sender: PushSender,
  ) {}

  publicKey() {
    return this.sender.publicKey();
  }

  subscribe(userId: string, subscription: StoredSubscription) {
    return this.subscriptions.save(userId, subscription);
  }

  unsubscribe(userId: string, endpoint: string) {
    return this.subscriptions.remove(userId, endpoint);
  }

  /** Sin llaves VAPID no hace nada; una falla se registra y no se propaga. */
  async notifyUsers(userIds: readonly string[], message: PushMessage): Promise<void> {
    if (!this.sender.publicKey() || userIds.length === 0) return;
    try {
      const targets = await this.subscriptions.forUsers(userIds);
      const payload = JSON.stringify(message);
      await Promise.all(
        targets.map(async (target) => {
          try {
            if ((await this.sender.send(target, payload)) === 'gone') {
              await this.subscriptions.forget(target.endpoint);
            }
          } catch (error) {
            this.logger.warn(`No se pudo avisar a un celular: ${(error as Error).message}`);
          }
        }),
      );
    } catch (error) {
      this.logger.warn(`No se pudieron mandar los avisos: ${(error as Error).message}`);
    }
  }
}
