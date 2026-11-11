import { describe, expect, it } from 'vitest';

import { isPushServiceUrl, PushSubscriptionRequestSchema } from './push.js';

const keys = { p256dh: 'k', auth: 'a' };

describe('suscripción a avisos (auditoría 2026-11-10, M2)', () => {
  it('acepta los servicios de avisos de los navegadores', () => {
    for (const url of [
      'https://fcm.googleapis.com/fcm/send/abc',
      'https://updates.push.services.mozilla.com/wpush/v2/abc',
      'https://web.push.apple.com/QAbc',
      'https://wns2-par02p.notify.windows.com/w/?token=abc',
    ]) {
      expect(isPushServiceUrl(url)).toBe(true);
      expect(PushSubscriptionRequestSchema.safeParse({ endpoint: url, keys }).success).toBe(true);
    }
  });

  it('rechaza cualquier otra dirección', () => {
    for (const url of [
      'https://evil.example/fcm.googleapis.com',
      'https://fcm.googleapis.com.evil.example/x',
      'https://fcm.googleapis.com:8443/x',
      'http://fcm.googleapis.com/x',
      'https://169.254.169.254/latest',
      'https://evilpush.apple.com.attacker.io/x',
    ]) {
      expect(isPushServiceUrl(url)).toBe(false);
    }
  });
});
