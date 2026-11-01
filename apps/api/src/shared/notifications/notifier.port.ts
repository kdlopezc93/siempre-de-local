/**
 * Avisar a personas (Fase 7, D16). Lo implementa el módulo notifications (Web Push); quien
 * avisa no sabe cómo llega. Un aviso que falla nunca hace fallar lo que lo causó.
 */
export type PushMessage =
  | {
      /**
       * Convocatoria (a un partido o a un entreno), alineación publicada o figura del partido
       * (felicitación, D18).
       */
      kind: 'match-called' | 'training-called' | 'lineup-published' | 'match-figure';
      /** El rival: lo único del partido que viaja (la hora la formatea el celular). */
      opponent: string;
      startsAt: string;
      /** Ruta de la app a la que lleva el aviso. */
      url: string;
    }
  | {
      /**
       * El cuerpo técnico recuerda el test a los que no lo han hecho (2026-10-26); el tesorero,
       * los cobros a los que deben (`charges-reminder`, 2026-10-31, sin el valor).
       */
      kind: 'test-reminder' | 'charges-reminder';
      /** El nombre del equipo: lo único que viaja. */
      team: string;
      /**
       * Lo mismo, para el service worker viejo (no conoce este aviso y muestra el neutro con
       * `opponent`): que diga el equipo y no "undefined".
       */
      opponent: string;
      url: string;
    }
  | {
      /**
       * Un cobro nuevo del equipo (2026-10-30, `06` Cobros): sin el valor, solo de qué es. Los
       * patrocinios (2026-10-31): a quien le cubrieron su parte (`charge-covered`, sin decir
       * quién) y a quien asumió la de un compañero (`charge-sponsor`).
       */
      kind: 'charge-created' | 'charge-covered' | 'charge-sponsor';
      /** "Vaca", "Inscripción" o el nombre que le pusieron. */
      charge: string;
      /** Lo mismo, para el service worker viejo (muestra el neutro con `opponent`). */
      opponent: string;
      url: string;
    }
  | {
      /**
       * Recordatorio automático (2026-10-31): mañana u hoy vence un cobro y debes tu parte. Sin
       * el valor.
       */
      kind: 'charge-due';
      charge: string;
      when: 'tomorrow' | 'today';
      /** Lo mismo, para el service worker viejo (muestra el neutro con `opponent`). */
      opponent: string;
      url: string;
    };

export interface Notifier {
  notifyUsers(userIds: readonly string[], message: PushMessage): Promise<void>;
}

export const NOTIFIER = Symbol('NOTIFIER');
