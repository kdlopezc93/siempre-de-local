import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { startPostgres } from '../../test/postgres.js';
import { createDb, type DbConnection } from './client.js';

describe('createDb', () => {
  let container: StartedPostgreSqlContainer;
  let connection: DbConnection;

  beforeAll(async () => {
    container = await startPostgres();
    connection = createDb(container.getConnectionUri());
  });

  afterAll(async () => {
    await connection?.pool.end();
    await container?.stop();
  });

  it('se conecta a Postgres 18', async () => {
    const result = await connection.db.execute<{ server_version: string }>(
      sql`show server_version`,
    );
    expect(result.rows[0]?.server_version).toMatch(/^18\./);
  });
});
