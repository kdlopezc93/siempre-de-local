import { drizzle, type NodePgDatabase } from 'drizzle-orm/node-postgres';
import pg from 'pg';

import * as schema from './schema.js';

export type Database = NodePgDatabase<typeof schema>;

export interface DbConnection {
  db: Database;
  pool: pg.Pool;
}

export function createDb(databaseUrl: string): DbConnection {
  const pool = new pg.Pool({ connectionString: databaseUrl });
  const db = drizzle({ client: pool, schema, casing: 'snake_case' });
  return { db, pool };
}
