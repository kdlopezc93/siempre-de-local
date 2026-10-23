import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import {
  ErrorBodySchema,
  MeResponseSchema,
  POLICY_VERSION,
  ProfileResponseSchema,
} from '@sdl/contracts';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { bootApp, TEST_ENV } from '../../../test/app.js';
import { startMigratedPostgres } from '../../../test/postgres.js';
import { seedUserWithSession, type SeededUser } from '../../../test/sessions.js';

describe('perfil propio', () => {
  let container: StartedPostgreSqlContainer;
  let app: NestFastifyApplication;
  let kevin: SeededUser, noConsent: SeededUser;

  const call = (
    method: 'GET' | 'PATCH' | 'PUT' | 'POST',
    path: string,
    who: SeededUser,
    payload?: object,
  ) =>
    app.inject({
      method,
      url: `/api/v1${path}`,
      headers: {
        cookie: who.cookie,
        origin: TEST_ENV.WEB_ORIGIN,
        ...(payload ? { 'content-type': 'application/json' } : {}),
      },
      ...(payload ? { payload } : {}),
    });

  beforeAll(async () => {
    container = await startMigratedPostgres();
    const url = container.getConnectionUri();
    kevin = await seedUserWithSession(url, { name: 'Kevin López', email: 'kevin@example.com' });
    noConsent = await seedUserWithSession(url, { name: 'Otro', email: 'otro@example.com' });
    app = await bootApp(url);
    await call('POST', '/me/consent', kevin, { policyVersion: POLICY_VERSION, ageConfirmed: true });
  });

  afterAll(async () => {
    await app?.close();
    vi.unstubAllEnvs();
    await container?.stop();
  });

  const me = async (who: SeededUser) =>
    MeResponseSchema.parse((await call('GET', '/me', who)).json()).profile;

  it('sin editar, el nombre visible es el de Google', async () => {
    expect(await me(kevin)).toEqual({
      displayName: 'Kevin López',
      dominantFoot: null,
      playsGoalkeeper: false,
      preferredPositions: [],
      photoUrl: null,
    });
  });

  it('PATCH cambia solo lo que se manda', async () => {
    const first = await call('PATCH', '/me/profile', kevin, {
      displayName: '  Kevo  ',
      dominantFoot: 'left',
    });
    expect(first.statusCode).toBe(200);
    expect(ProfileResponseSchema.parse(first.json()).profile).toMatchObject({
      displayName: 'Kevo',
      dominantFoot: 'left',
    });

    await call('PATCH', '/me/profile', kevin, { playsGoalkeeper: true });
    expect(await me(kevin)).toMatchObject({
      displayName: 'Kevo',
      dominantFoot: 'left',
      playsGoalkeeper: true,
    });
  });

  it('las posiciones preferidas se reemplazan en orden', async () => {
    await call('PUT', '/me/preferred-positions', kevin, { positions: ['MC', 'MCD', 'DFC'] });
    expect((await me(kevin)).preferredPositions).toEqual(['MC', 'MCD', 'DFC']);

    await call('PUT', '/me/preferred-positions', kevin, { positions: ['EXT'] });
    expect((await me(kevin)).preferredPositions).toEqual(['EXT']);
  });

  it.each([
    ['más de 3', { positions: ['MC', 'MCD', 'DFC', 'DC'] }],
    ['repetidas', { positions: ['MC', 'MC'] }],
    ['desconocida', { positions: ['CB'] }],
  ])('rechaza posiciones %s', async (_, payload) => {
    const res = await call('PUT', '/me/preferred-positions', kevin, payload);
    expect(res.statusCode).toBe(400);
  });

  it('rechaza un nombre vacío', async () => {
    expect((await call('PATCH', '/me/profile', kevin, { displayName: ' ' })).statusCode).toBe(400);
  });

  it('editar exige la política aceptada', async () => {
    const res = await call('PATCH', '/me/profile', noConsent, { dominantFoot: 'right' });
    expect(res.statusCode).toBe(403);
    expect(ErrorBodySchema.parse(res.json()).error.code).toBe('CONSENT_REQUIRED');
  });
});
