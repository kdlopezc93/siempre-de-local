import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { ErrorBodySchema, HealthResponseSchema } from '@sdl/contracts';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { bootApp } from '../../../test/app.js';
import { startPostgres } from '../../../test/postgres.js';

describe('GET /api/v1/health', () => {
  let container: StartedPostgreSqlContainer;

  beforeAll(async () => {
    container = await startPostgres();
  });

  afterAll(async () => {
    vi.unstubAllEnvs();
    await container?.stop();
  });

  it('responde 200 con la base de datos arriba', async () => {
    const app = await bootApp(container.getConnectionUri());
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    await app.close();

    expect(res.statusCode).toBe(200);
    expect(HealthResponseSchema.parse(res.json())).toEqual({
      status: 'ok',
      checks: { database: 'up' },
    });
  });

  it('responde 503 degradado si la base de datos no responde', async () => {
    const app = await bootApp('postgres://sdl:sdl@127.0.0.1:1/sdl');
    const res = await app.inject({ method: 'GET', url: '/api/v1/health' });
    await app.close();

    expect(res.statusCode).toBe(503);
    expect(res.json()).toEqual({ status: 'degraded', checks: { database: 'down' } });
  });

  it('usa el formato de error común en rutas inexistentes', async () => {
    const app = await bootApp(container.getConnectionUri());
    const res = await app.inject({ method: 'GET', url: '/api/v1/no-existe' });
    await app.close();

    expect(res.statusCode).toBe(404);
    expect(ErrorBodySchema.parse(res.json()).error.code).toBe('NOT_FOUND');
  });
});
