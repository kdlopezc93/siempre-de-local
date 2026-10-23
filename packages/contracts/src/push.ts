import { z } from 'zod';

/** GET /api/v1/push/public-key — null si el servidor no tiene avisos configurados. */
export const PushPublicKeyResponseSchema = z.object({ publicKey: z.string().nullable() });

/** POST /api/v1/me/push-subscriptions — la suscripción del navegador (PushSubscription.toJSON). */
export const PushSubscriptionRequestSchema = z.object({
  endpoint: z.url({ protocol: /^https$/ }).max(1000),
  keys: z.object({ p256dh: z.string().min(1).max(200), auth: z.string().min(1).max(100) }),
});

/** DELETE /api/v1/me/push-subscriptions */
export const PushUnsubscribeRequestSchema = z.object({ endpoint: z.url().max(1000) });

export type PushPublicKeyResponse = z.infer<typeof PushPublicKeyResponseSchema>;
export type PushSubscriptionRequest = z.infer<typeof PushSubscriptionRequestSchema>;
