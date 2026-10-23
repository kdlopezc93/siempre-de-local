import webpush from 'web-push';

import type { PushSender, StoredSubscription } from '../application/ports/push.ports.js';

/**
 * Web Push con llaves VAPID (`04` §6.2): cifra el aviso y lo entrega al servicio de push del
 * navegador (Google, Apple o Mozilla), que lo lleva al celular. Sin llaves, apagado.
 */
export class WebPushSender implements PushSender {
  private readonly enabled: boolean;

  constructor(
    private readonly keys: { publicKey?: string; privateKey?: string; subject?: string },
  ) {
    this.enabled = Boolean(keys.publicKey && keys.privateKey && keys.subject);
    if (this.enabled) webpush.setVapidDetails(keys.subject!, keys.publicKey!, keys.privateKey!);
  }

  publicKey() {
    return this.enabled ? this.keys.publicKey! : null;
  }

  async send(s: StoredSubscription, payload: string): Promise<'sent' | 'gone'> {
    try {
      await webpush.sendNotification(
        { endpoint: s.endpoint, keys: { p256dh: s.p256dh, auth: s.auth } },
        payload,
        // Que no se acumulen si el celular está apagado: un día alcanza.
        { TTL: 24 * 60 * 60, urgency: 'normal' },
      );
      return 'sent';
    } catch (error) {
      const status = (error as { statusCode?: number }).statusCode;
      if (status === 404 || status === 410) return 'gone';
      throw error;
    }
  }
}
