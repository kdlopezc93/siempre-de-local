/**
 * Avisar a personas (Fase 7, D16). Lo implementa el módulo notifications (Web Push); quien
 * avisa no sabe cómo llega. Un aviso que falla nunca hace fallar lo que lo causó.
 */
export type PushMessage =
  | {
      /** Convocatoria, alineación publicada o figura del partido (felicitación, D18). */
      kind: 'match-called' | 'lineup-published' | 'match-figure';
      /** El rival: lo único del partido que viaja (la hora la formatea el celular). */
      opponent: string;
      startsAt: string;
      /** Ruta de la app a la que lleva el aviso. */
      url: string;
    }
  | {
      /** El cuerpo técnico recuerda el test a los que no lo han hecho (2026-10-26). */
      kind: 'test-reminder';
      /** El nombre del equipo: lo único que viaja. */
      team: string;
      /**
       * Lo mismo, para el service worker viejo (no conoce este aviso y muestra el neutro con
       * `opponent`): que diga el equipo y no "undefined".
       */
      opponent: string;
      url: string;
    };

export interface Notifier {
  notifyUsers(userIds: readonly string[], message: PushMessage): Promise<void>;
}

export const NOTIFIER = Symbol('NOTIFIER');
