import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { fileURLToPath } from 'node:url';

import { createDb } from '../shared/db/client.js';

/**
 * Aplica las migraciones de apps/api/drizzle sin drizzle-kit (que es de desarrollo):
 * lo corre el despliegue antes de arrancar la versión nueva (fly.toml, release_command).
 */
const MIGRATIONS = fileURLToPath(new URL('../../drizzle', import.meta.url));

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) throw new Error('Falta DATABASE_URL');

const { db, pool } = createDb(databaseUrl);
try {
  await migrate(db, { migrationsFolder: MIGRATIONS });
  console.log('Migraciones al día');
} finally {
  await pool.end();
}
