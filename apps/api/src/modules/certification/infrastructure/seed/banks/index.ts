import type { CertBankContent } from '../../../application/cert-bank.js';
import { DC_V1 } from './dc-v1.bank.js';
import { DFC_V1 } from './dfc-v1.bank.js';
import { DFC_V2 } from './dfc-v2.bank.js';
import { LAT_V1 } from './lat-v1.bank.js';
import { MC_V1 } from './mc-v1.bank.js';
import { MC_V2 } from './mc-v2.bank.js';

/**
 * Bancos del examen de conocimiento, en orden de publicación (una versión nueva de una
 * posición retira la anterior). Los que no tienen `review` son borradores: el lint los
 * revisa, pero `db:seed` no los publica.
 */
export const CERT_BANKS: readonly CertBankContent[] = [DFC_V1, MC_V1, DFC_V2, MC_V2, LAT_V1, DC_V1];
