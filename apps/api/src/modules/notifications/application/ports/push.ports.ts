export interface StoredSubscription {
  endpoint: string;
  p256dh: string;
  auth: string;
}

export interface SubscriptionsRepository {
  /** Guarda o mueve (si el celular cambió de cuenta) la suscripción de un navegador. */
  save(userId: string, subscription: StoredSubscription): Promise<void>;
  remove(userId: string, endpoint: string): Promise<void>;
  forUsers(userIds: readonly string[]): Promise<StoredSubscription[]>;
  /** El servicio de push dijo que ya no existe. */
  forget(endpoint: string): Promise<void>;
}

/** Manda un aviso cifrado al servicio de push del navegador. */
export interface PushSender {
  /** La llave pública VAPID, o null si los avisos no están configurados. */
  publicKey(): string | null;
  /** `gone` si la suscripción ya no existe (404 o 410). */
  send(subscription: StoredSubscription, payload: string): Promise<'sent' | 'gone'>;
}

export const SUBSCRIPTIONS_REPOSITORY = Symbol('SUBSCRIPTIONS_REPOSITORY');
export const PUSH_SENDER = Symbol('PUSH_SENDER');
