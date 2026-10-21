export interface ConsentRecord {
  policyVersion: string;
  acceptedAt: Date;
}

export interface ConsentRepository {
  /** Aceptación vigente (no revocada) de esa versión, o null. */
  findActive(userId: string, policyVersion: string): Promise<ConsentRecord | null>;
  record(userId: string, policyVersion: string, at: Date): Promise<ConsentRecord>;
}

export const CONSENT_REPOSITORY = Symbol('CONSENT_REPOSITORY');
