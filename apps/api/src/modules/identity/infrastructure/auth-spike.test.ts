import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { ErrorBodySchema, MeResponseSchema } from '@sdl/contracts';
import { makeSignature } from 'better-auth/crypto';
import pg from 'pg';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { bootApp, TEST_ENV } from '../../../test/app.js';
import { startMigratedPostgres } from '../../../test/postgres.js';

/** Nombre real de la cookie: prefijo `sdl` + `__Secure-` por ir sobre HTTPS. */
const SESSION_COOKIE = '__Secure-sdl.session_token';

/** Siembra un usuario con sesión y devuelve la cookie firmada como la emite Better Auth. */
async function seedSession(databaseUrl: string): Promise<{ userId: string; cookie: string }> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  const { rows } = await client.query<{ id: string }>(
    `insert into "user" (name, email, email_verified) values ('Kevin', 'kevin@example.com', true)
     returning id`,
  );
  const userId = rows[0]!.id;
  const token = 'token-de-prueba';
  await client.query(
    `insert into session (user_id, token, expires_at) values ($1, $2, now() + interval '30 days')`,
    [userId, token],
  );
  await client.end();
  const signature = await makeSignature(token, TEST_ENV.BETTER_AUTH_SECRET);
  return { userId, cookie: `${SESSION_COOKIE}=${encodeURIComponent(`${token}.${signature}`)}` };
}

describe('spike de auth: Better Auth + Nest + Fastify', () => {
  let container: StartedPostgreSqlContainer;
  let app: NestFastifyApplication;
  let session: { userId: string; cookie: string };

  beforeAll(async () => {
    container = await startMigratedPostgres();
    session = await seedSession(container.getConnectionUri());
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
