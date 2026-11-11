import { Inject, Injectable, Logger } from '@nestjs/common';

import { isPushServiceUrl } from '@sdl/contracts';

import type { Notifier, PushMessage } from '../../../shared/notifications/notifier.port.js';
import {
  PUSH_SENDER,
  type PushSender,
  type StoredSubscription,
  SUBSCRIPTIONS_REPOSITORY,
  type SubscriptionsRepository,
} from './ports/push.ports.js';
import { guardianNotice } from './guardian-notice.js';

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

  /**
   * Sin llaves VAPID no hace nada; una falla se registra y no se propaga. Si alguno es un menor
   * (escuelas, 2026-11-10), a sus acudientes les llega la copia con su nombre.
   */
  async notifyUsers(userIds: readonly string[], message: PushMessage): Promise<void> {
    if (!this.sender.publicKey() || userIds.length === 0) return;
    try {
      const [targets, guardians] = await Promise.all([
        this.subscriptions.forUsers(userIds),
        this.subscriptions.guardiansOf(userIds),
      ]);
      const copies = await Promise.all(
        guardians.map(async (g) => {
          const notice = guardianNotice(message, g);
          return notice
            ? (await this.subscriptions.forUsers([g.guardianId])).map((t) => ({
                target: t,
                payload: JSON.stringify(notice),
              }))
            : [];
        }),
      );
      const payload = JSON.stringify(message);
      await Promise.all(
        [...targets.map((target) => ({ target, payload })), ...copies.flat()].map((d) =>
          this.deliver(d.target, d.payload),
        ),
      );
    } catch (error) {
      this.logger.warn(`No se pudieron mandar los avisos: ${(error as Error).message}`);
    }
  }

  async forgetDevicesOf(userId: string): Promise<void> {
    try {
      await this.subscriptions.removeAll(userId);
    } catch (error) {
      this.logger.warn(`No se pudieron olvidar los celulares: ${(error as Error).message}`);
    }
  }

  private async deliver(target: StoredSubscription, payload: string) {
    try {
      // La lista de servicios se revisa también aquí, no solo al suscribirse: las suscripciones
      // guardadas antes de la lista (auditoría 2026-11-11) no deben recibir nada y se olvidan.
      if (!isPushServiceUrl(target.endpoint)) {
        await this.subscriptions.forget(target.endpoint);
        return;
      }
      if ((await this.sender.send(target, payload)) === 'gone') {
        await this.subscriptions.forget(target.endpoint);
      }
    } catch (error) {
      this.logger.warn(`No se pudo avisar a un celular: ${(error as Error).message}`);
    }
  }
}
