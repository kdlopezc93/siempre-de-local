/**
 * Avisar a personas (Fase 7, D16). Lo implementa el módulo notifications (Web Push); quien
 * avisa no sabe cómo llega. Un aviso que falla nunca hace fallar lo que lo causó.
 */
export interface PushMessage {
  kind: 'match-called' | 'lineup-published';
  /** El rival: lo único del partido que viaja (la hora la formatea el celular). */
  opponent: string;
  startsAt: string;
  /** Ruta de la app a la que lleva el aviso. */
  url: string;
}

export interface Notifier {
  notifyUsers(userIds: readonly string[], message: PushMessage): Promise<void>;
}

export const NOTIFIER = Symbol('NOTIFIER');
