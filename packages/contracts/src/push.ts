import { z } from 'zod';

/** GET /api/v1/push/public-key — null si el servidor no tiene avisos configurados. */
export const PushPublicKeyResponseSchema = z.object({ publicKey: z.string().nullable() });

/**
 * Los servicios de avisos de los navegadores (auditoría 2026-11-10, M2): el servidor solo le
 * manda avisos a estos. Si no, una "suscripción" con otra dirección haría que el API le pegue a
 * cualquier sitio. Chrome, Android y Samsung: FCM; Firefox: Mozilla; Safari: Apple; Edge: WNS.
 */
const PUSH_HOSTS = [
  /^fcm\.googleapis\.com$/,
  /^android\.googleapis\.com$/,
  /^updates\.push\.services\.mozilla\.com$/,
  /^([a-z0-9-]+\.)*push\.apple\.com$/,
  /^([a-z0-9-]+\.)*notify\.windows\.com$/,
];

/** El host de una URL https sin usuario ni puerto ("https://host/…"), o null. */
const HTTPS_HOST = /^https:\/\/([a-z0-9.-]+)(?:[/?#]|$)/i;

export function isPushServiceUrl(url: string): boolean {
  const host = HTTPS_HOST.exec(url)?.[1]?.toLowerCase();
  return !!host && PUSH_HOSTS.some((pattern) => pattern.test(host));
}

/** POST /api/v1/me/push-subscriptions — la suscripción del navegador (PushSubscription.toJSON). */
export const PushSubscriptionRequestSchema = z.object({
  endpoint: z
    .url({ protocol: /^https$/ })
    .max(1000)
    .refine(isPushServiceUrl, 'No es un servicio de avisos conocido'),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

/** DELETE /api/v1/me/push-subscriptions */
export const PushUnsubscribeRequestSchema = z.object({ endpoint: z.url().max(1000) });

export type PushPublicKeyResponse = z.infer<typeof PushPublicKeyResponseSchema>;
export type PushSubscriptionRequest = z.infer<typeof PushSubscriptionRequestSchema>;
