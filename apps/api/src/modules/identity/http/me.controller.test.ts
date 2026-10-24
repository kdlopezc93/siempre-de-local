import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import {
  AcceptConsentResponseSchema,
  ErrorBodySchema,
  MeResponseSchema,
  POLICY_VERSION,
} from '@sdl/contracts';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createDb, type DbConnection } from '../../../shared/db/client.js';
import { bootApp, TEST_ENV } from '../../../test/app.js';
import { startMigratedPostgres } from '../../../test/postgres.js';
import { seedUserWithSession, type SeededUser } from '../../../test/sessions.js';
import { bootstrapTeam } from '../../teams/infrastructure/bootstrap-team.js';
import { teamMembership } from '../../teams/infrastructure/schema.js';

describe('/api/v1/me y consentimiento', () => {
  let container: StartedPostgreSqlContainer;
  let connection: DbConnection;
  let app: NestFastifyApplication;
  let kevin: SeededUser;

  const me = async (who: SeededUser) =>
    MeResponseSchema.parse(
      (
        await app.inject({ method: 'GET', url: '/api/v1/me', headers: { cookie: who.cookie } })
      ).json(),
    );
  const accept = (who: SeededUser, payload: object) =>
    app.inject({
      method: 'POST',
      url: '/api/v1/me/consent',
      headers: {
        cookie: who.cookie,
        origin: TEST_ENV.WEB_ORIGIN,
        'content-type': 'application/json',
      },
      payload,
    });

  beforeAll(async () => {
    container = await startMigratedPostgres();
    const url = container.getConnectionUri();
    connection = createDb(url);
    kevin = await seedUserWithSession(url, { name: 'Kevin', email: 'kevin@example.com' });
    app = await bootApp(url);
  });

  afterAll(async () => {
    await app?.close();
    await connection?.pool.end();
    vi.unstubAllEnvs();
    await container?.stop();
  });

  it('una cuenta recién creada no tiene consentimiento ni equipos', async () => {
    expect(await me(kevin)).toMatchObject({ consent: null, teams: [], clubs: [] });
  });

  it('exige declarar la mayoría de edad y la versión vigente', async () => {
    const noAge = await accept(kevin, { policyVersion: POLICY_VERSION, ageConfirmed: false });
    expect(noAge.statusCode).toBe(400);

    const old = await accept(kevin, { policyVersion: '2020-01', ageConfirmed: true });
    expect(old.statusCode).toBe(422);
    expect(ErrorBodySchema.parse(old.json()).error.code).toBe('POLICY_VERSION_OUTDATED');
    expect((await me(kevin)).consent).toBeNull();
  });

  it('aceptar guarda la prueba y es idempotente', async () => {
    const first = await accept(kevin, { policyVersion: POLICY_VERSION, ageConfirmed: true });
    expect(first.statusCode).toBe(201);
    const { consent } = AcceptConsentResponseSchema.parse(first.json());
    expect(consent.policyVersion).toBe(POLICY_VERSION);

    const again = AcceptConsentResponseSchema.parse(
      (await accept(kevin, { policyVersion: POLICY_VERSION, ageConfirmed: true })).json(),
    );
    expect(again.consent.acceptedAt).toBe(consent.acceptedAt);
    expect((await me(kevin)).consent).toEqual(consent);
  });

  it('lista los equipos con todos sus roles y los clubs que administra', async () => {
    const { teamId } = await bootstrapTeam(connection.db, {
      clubName: 'Los del Barrio',
      clubSlug: 'los-del-barrio',
      teamName: 'Primer equipo',
      format: 'F11',
      season: '2026',
      ownerEmail: 'kevin@example.com',
      coachEmail: 'kevin@example.com',
    });
    await connection.db
      .insert(teamMembership)
      .values({ teamId, userId: kevin.userId, role: 'player', jerseyNumber: 10 });

    const { teams, clubs } = await me(kevin);
    expect(teams).toEqual([
      {
        team: {
          id: teamId,
          name: 'Primer equipo',
          format: 'F11',
          formats: ['F11'],
          season: '2026',
        },
        club: { id: clubs[0]!.id, name: 'Los del Barrio' },
        roles: ['coach', 'player'],
        jerseyNumber: 10,
        injury: null,
      },
    ]);
    expect(clubs).toEqual([{ id: expect.any(String), name: 'Los del Barrio', role: 'owner' }]);
  });
});
