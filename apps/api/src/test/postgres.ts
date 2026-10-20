import { PostgreSqlContainer, type StartedPostgreSqlContainer } from '@testcontainers/postgresql';

/** Misma imagen que docker-compose.yml para que los tests usen el Postgres real. */
export const POSTGRES_IMAGE = 'postgres:18.6-alpine';

export function startPostgres(): Promise<StartedPostgreSqlContainer> {
  return new PostgreSqlContainer(POSTGRES_IMAGE).start();
}
