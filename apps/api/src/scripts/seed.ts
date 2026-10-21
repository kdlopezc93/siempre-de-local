import { ORIENTATION_V1 } from '../modules/questionnaires/infrastructure/seed/orientation-v1.content.js';
import { seedOrientationContent } from '../modules/questionnaires/infrastructure/seed/seed-orientation.js';
import { createDb } from '../shared/db/client.js';

/** pnpm db:seed — contenido inicial (02 §2). Idempotente: se puede correr en cada despliegue. */
const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) throw new Error('Falta DATABASE_URL');

const { db, pool } = createDb(databaseUrl);
try {
  const outcome = await seedOrientationContent(db, ORIENTATION_V1);
  console.log(
    `Cuestionario ${ORIENTATION_V1.label}: ${outcome === 'created' ? 'publicado' : 'ya existía'}`,
  );
} finally {
  await pool.end();
}
