import { ORIENTATION_V1 } from '../modules/questionnaires/infrastructure/seed/orientation-v1.content.js';
import { ORIENTATION_V2 } from '../modules/questionnaires/infrastructure/seed/orientation-v2.content.js';
import { seedOrientationContent } from '../modules/questionnaires/infrastructure/seed/seed-orientation.js';
import { createDb } from '../shared/db/client.js';

/**
 * pnpm db:seed — contenido inicial (02 §2). Idempotente: se puede correr en cada despliegue.
 * En orden: cada versión nueva retira la anterior, así que queda vigente la última.
 */
const VERSIONS = [ORIENTATION_V1, ORIENTATION_V2];

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
} finally {
  await pool.end();
}
