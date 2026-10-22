import type { CertBankContent } from '../../../application/cert-bank.js';
import { DFC_V1 } from './dfc-v1.bank.js';
import { MC_V1 } from './mc-v1.bank.js';

/**
 * Bancos del examen de conocimiento, en orden de publicación (una versión nueva de una
 * posición retira la anterior). Los que no tienen `review` son borradores: el lint los
 * revisa, pero `db:seed` no los publica.
 */
export const CERT_BANKS: readonly CertBankContent[] = [DFC_V1, MC_V1];
