/**
 * ¿Aceptó el usuario la política vigente? Lo implementa identity; vive aquí para que
 * otros módulos (invitaciones, test…) lo exijan sin depender de identity.
 */
export interface ConsentChecker {
  hasCurrentConsent(userId: string): Promise<boolean>;
}

export const CONSENT_CHECKER = Symbol('CONSENT_CHECKER');
