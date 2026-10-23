import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { ErrorBodySchema, MeResponseSchema } from '@sdl/contracts';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { bootApp, TEST_ENV } from '../../../test/app.js';
import { startMigratedPostgres } from '../../../test/postgres.js';
import { SESSION_COOKIE, seedUserWithSession } from '../../../test/sessions.js';

describe('spike de auth: Better Auth + Nest + Fastify', () => {
  let container: StartedPostgreSqlContainer;
  let app: NestFastifyApplication;
  let session: { userId: string; cookie: string };

  beforeAll(async () => {
    container = await startMigratedPostgres();
    session = await seedUserWithSession(container.getConnectionUri(), {
      name: 'Kevin',
      email: 'kevin@example.com',
    });
    app = await bootApp(container.getConnectionUri());
  });

  afterAll(async () => {
    await app?.close();
    vi.unstubAllEnvs();
    await container?.stop();
  });

  it('GET /api/v1/me sin sesión → 401 con el formato común', async () => {
    const res = await app.inject({ method: 'GET', url: '/api/v1/me' });
    expect(res.statusCode).toBe(401);
    expect(ErrorBodySchema.parse(res.json()).error.code).toBe('UNAUTHENTICATED');
  });

  it('GET /api/v1/me con cookie de sesión → 200 con el usuario', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { cookie: session.cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(MeResponseSchema.parse(res.json())).toEqual({
      user: { id: session.userId, name: 'Kevin', email: 'kevin@example.com' },
      profile: {
        displayName: 'Kevin',
        dominantFoot: null,
        playsGoalkeeper: false,
        preferredPositions: [],
        photoUrl: null,
      },
      consent: null,
      teams: [],
      clubs: [],
    });
  });

  it('una cookie con firma inválida no abre sesión', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/v1/me',
      headers: { cookie: `${SESSION_COOKIE}=token-de-prueba.firma-falsa` },
    });
    expect(res.statusCode).toBe(401);
  });

  it('Better Auth responde en /api/auth/* montado sobre Fastify', async () => {
    const res = await app.inject({
      method: 'GET',
      url: '/api/auth/get-session',
      headers: { cookie: session.cookie },
    });
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ user: { id: session.userId } });
  });

  it('el login con Google redirige a Google y fija la cookie de estado en el dominio padre', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/social',
      headers: { origin: TEST_ENV.WEB_ORIGIN, 'content-type': 'application/json' },
      payload: { provider: 'google', callbackURL: `${TEST_ENV.WEB_ORIGIN}/` },
    });
    expect(res.statusCode).toBe(200);

    const { url } = res.json<{ url: string }>();
    const google = new URL(url);
    expect(google.hostname).toBe('accounts.google.com');
    expect(google.searchParams.get('scope')?.split(' ').sort()).toEqual([
      'email',
      'openid',
      'profile',
    ]);
    expect(google.searchParams.get('redirect_uri')).toBe(
      `${TEST_ENV.BETTER_AUTH_URL}/api/auth/callback/google`,
    );

    const cookies = [res.headers['set-cookie']].flat().join('\n');
    expect(cookies).toMatch(/Domain=sdl\.test/i);
    expect(cookies).toMatch(/HttpOnly/i);
    expect(cookies).toMatch(/SameSite=Lax/i);
    expect(cookies).toMatch(/Secure/);
  });

  it('Better Auth rechaza el login desde un origen no confiable', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/auth/sign-in/social',
      headers: { origin: 'https://evil.example', 'content-type': 'application/json' },
      payload: { provider: 'google', callbackURL: 'https://evil.example/' },
    });
    expect(res.statusCode).toBe(403);
  });

  it('el preflight de CORS permite los métodos que usa la PWA (incluido DELETE)', async () => {
    for (const method of ['POST', 'PUT', 'PATCH', 'DELETE']) {
      const res = await app.inject({
        method: 'OPTIONS',
        url: '/api/v1/teams/x/invitations/y',
        headers: { origin: TEST_ENV.WEB_ORIGIN, 'access-control-request-method': method },
      });
      expect(res.headers['access-control-allow-methods']).toContain(method);
    }
  });

  it('CORS permite solo el origen de la PWA, con credenciales', async () => {
    const res = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/me',
      headers: { origin: TEST_ENV.WEB_ORIGIN, 'access-control-request-method': 'GET' },
    });
    expect(res.headers['access-control-allow-origin']).toBe(TEST_ENV.WEB_ORIGIN);
    expect(res.headers['access-control-allow-credentials']).toBe('true');

    const evil = await app.inject({
      method: 'OPTIONS',
      url: '/api/v1/me',
      headers: { origin: 'https://evil.example', 'access-control-request-method': 'GET' },
    });
    // @fastify/cors con origen fijo siempre responde ese origen; el navegador bloquea el resto.
    expect(evil.headers['access-control-allow-origin']).not.toBe('https://evil.example');
  });

  it('un POST a /api/v1 desde otro origen → 403 aunque lleve la cookie (CSRF)', async () => {
    const res = await app.inject({
      method: 'POST',
      url: '/api/v1/me',
      headers: { origin: 'https://evil.example', cookie: session.cookie },
    });
    expect(res.statusCode).toBe(403);
    expect(ErrorBodySchema.parse(res.json()).error.code).toBe('FORBIDDEN_ORIGIN');
  });
});
