import type { CertBankContent } from '../../../application/cert-bank.js';

/**
 * Bancos del examen de conocimiento, en orden de publicación (una versión nueva de una
 * posición retira la anterior). Los que no tienen `review` son borradores: el lint los
 * revisa, pero `db:seed` no los publica.
 */
export const CERT_BANKS: readonly CertBankContent[] = [];
