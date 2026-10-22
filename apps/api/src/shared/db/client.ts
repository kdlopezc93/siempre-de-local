import { Logger } from '@nestjs/common';
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
  // Si Postgres corta una conexión ociosa (reinicio, failover), el pool emite 'error'.
  // Sin quien lo escuche, Node lo trata como excepción no manejada y tumba el proceso;
  // el pool ya descarta esa conexión y abre otra en la siguiente consulta.
  pool.on('error', (error) => {
    new Logger('Database').warn(`Conexión ociosa cerrada por Postgres: ${error.message}`);
  });
  const db = drizzle({ client: pool, schema, casing: 'snake_case' });
  return { db, pool };
}
