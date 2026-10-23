import { parseArgs } from 'node:util';

import { ORIENTATION_V1 } from '../modules/questionnaires/infrastructure/seed/orientation-v1.content.js';
import { ORIENTATION_V2 } from '../modules/questionnaires/infrastructure/seed/orientation-v2.content.js';
import { ORIENTATION_V3 } from '../modules/questionnaires/infrastructure/seed/orientation-v3.content.js';
import { seedOrientationContent } from '../modules/questionnaires/infrastructure/seed/seed-orientation.js';
import { CERT_BANKS } from '../modules/certification/infrastructure/seed/banks/index.js';
import { publishCertBank } from '../modules/certification/infrastructure/seed/publish-cert-bank.js';
import { createDb } from '../shared/db/client.js';

/**
 * pnpm db:seed — contenido inicial (02 §2). Idempotente: se puede correr en cada despliegue.
 * En orden: cada versión nueva retira la anterior, así que queda vigente la última.
 */
const VERSIONS = [ORIENTATION_V1, ORIENTATION_V2, ORIENTATION_V3];

const { values } = parseArgs({
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: { drafts: { type: 'boolean', default: false } },
});
// --drafts publica los bancos sin revisar para probar en desarrollo; nunca en producción.
if (values.drafts && process.env['NODE_ENV'] === 'production') {
  console.error('Los borradores no se publican en producción.');
  process.exit(1);
}

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) throw new Error('Falta DATABASE_URL');

const { db, pool } = createDb(databaseUrl);
try {
  for (const content of VERSIONS) {
    const outcome = await seedOrientationContent(db, content);
    console.log(
      `Cuestionario ${content.label}: ${outcome === 'created' ? 'publicado' : 'ya existía'}`,
    );
  }
  for (const bank of CERT_BANKS) {
    const outcome = await publishCertBank(db, bank, { draftsForDevelopment: values.drafts });
    const said = {
      published: 'publicado',
      'already-exists': 'ya existía',
      'review-updated': 'ya existía; se actualizó quién lo revisó',
      'pending-review': 'borrador sin revisar, no se publica',
    }[outcome];
    const label = !bank.review && values.drafts ? `${bank.label}-borrador` : bank.label;
    console.log(`Banco ${bank.position} ${label}: ${said}`);
  }
} finally {
  await pool.end();
}
