import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { ErrorBodySchema } from '@sdl/contracts';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { bootApp } from '../../../test/app.js';
import { startMigratedPostgres } from '../../../test/postgres.js';

describe('límite de peticiones en invitaciones públicas', () => {
  let container: StartedPostgreSqlContainer;
  let app: NestFastifyApplication;

  beforeAll(async () => {
    container = await startMigratedPostgres();
    app = await bootApp(container.getConnectionUri());
  });

  afterAll(async () => {
    await app?.close();
    vi.unstubAllEnvs();
    await container?.stop();
  });

  // El API va detrás de un proxy (trustProxy): la IP real llega en X-Forwarded-For.
  const preview = (ip: string) =>
    app.inject({
      method: 'GET',
      url: '/api/v1/invitations/AAAAAAAAAA',
      headers: { 'x-forwarded-for': ip },
    });

  it('20 por minuto y por IP; después 429 RATE_LIMITED con mensaje para la persona', async () => {
    for (let i = 0; i < 20; i++) expect((await preview('203.0.113.7')).statusCode).toBe(404);

    const blocked = await preview('203.0.113.7');
    expect(blocked.statusCode).toBe(429);
    expect(ErrorBodySchema.parse(blocked.json()).error).toEqual({
      code: 'RATE_LIMITED',
      message: 'Demasiados intentos seguidos. Espera un minuto y vuelve a intentar.',
    });

    // Otra IP no paga por la primera.
    expect((await preview('198.51.100.4')).statusCode).toBe(404);
  });

  it('el resto del API no tiene este límite', async () => {
    for (let i = 0; i < 25; i++) {
      const res = await app.inject({
        method: 'GET',
        url: '/api/v1/health',
        headers: { 'x-forwarded-for': '203.0.113.8' },
      });
      expect(res.statusCode).not.toBe(429);
    }
  });
});
