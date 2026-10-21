import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { migrate } from 'drizzle-orm/node-postgres/migrator';
import { fileURLToPath } from 'node:url';

import { createDb } from '../shared/db/client.js';

/** Misma imagen que docker-compose.yml para que los tests usen el Postgres real. */
export const POSTGRES_IMAGE = 'postgres:18.6-alpine';

const MIGRATIONS = fileURLToPath(new URL('../../drizzle', import.meta.url));

export function startPostgres(): Promise<StartedPostgreSqlContainer> {
  return new PostgreSqlContainer(POSTGRES_IMAGE).start();
}

/** Arranca Postgres y aplica las migraciones reales del repo. */
export async function startMigratedPostgres(): Promise<StartedPostgreSqlContainer> {
  const container = await startPostgres();
  const { db, pool } = createDb(container.getConnectionUri());
  await migrate(db, { migrationsFolder: MIGRATIONS });
  await pool.end();
  return container;
}
