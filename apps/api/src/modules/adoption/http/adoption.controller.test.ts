import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { AdoptionResponseSchema, POLICY_VERSION } from '@sdl/contracts';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createDb, type DbConnection } from '../../../shared/db/client.js';
import { bootApp, TEST_ENV } from '../../../test/app.js';
import { startMigratedPostgres } from '../../../test/postgres.js';
import { seedUserWithSession, type SeededUser } from '../../../test/sessions.js';
import { dataConsent } from '../../identity/infrastructure/consent.schema.js';
import { session } from '../../identity/infrastructure/schema.js';
import { matchReply, teamMatch } from '../../matches/infrastructure/schema.js';
import { pushSubscription } from '../../notifications/infrastructure/schema.js';
import { bootstrapTeam } from '../../teams/infrastructure/bootstrap-team.js';
import { teamMembership } from '../../teams/infrastructure/schema.js';

describe('la app en el equipo (2026-11-06)', () => {
  let container: StartedPostgreSqlContainer;
  let connection: DbConnection;
  let app: NestFastifyApplication;
  let owner: SeededUser, ana: SeededUser, beto: SeededUser, ciro: SeededUser;
  let teamId: string;

  beforeAll(async () => {
    container = await startMigratedPostgres();
    const url = container.getConnectionUri();
    connection = createDb(url);
    const seed = (name: string) => seedUserWithSession(url, { name, email: `${name}@example.com` });
    owner = await seed('owner');
    ana = await seed('ana');
    beto = await seed('beto');
    ciro = await seed('ciro');
    ({ teamId } = await bootstrapTeam(connection.db, {
      clubName: 'Los del Barrio',
      clubSlug: 'los-del-barrio',
      format: 'F11',
      teamName: 'Primer equipo',
      season: '2026',
      ownerEmail: 'owner@example.com',
      coachEmail: 'owner@example.com',
    }));
    const { db } = connection;
    await db.insert(teamMembership).values([
      { teamId, userId: ana.userId, role: 'player', jerseyNumber: 4 },
      { teamId, userId: beto.userId, role: 'player', jerseyNumber: 9 },
      { teamId, userId: ciro.userId, role: 'player', injuredAt: new Date() },
    ]);
    await db.insert(dataConsent).values(
      [owner, ana, beto, ciro].map((u) => ({
        userId: u.userId,
        policyVersion: POLICY_VERSION,
        ageConfirmed: true,
      })),
    );
    // Beto no entra hace 10 días; Ana tiene avisos y respondió la última convocatoria.
    await db
      .update(session)
      .set({ updatedAt: new Date(Date.now() - 10 * 86_400_000) })
      .where(eq(session.userId, beto.userId));
    await db
      .insert(pushSubscription)
      .values({ userId: ana.userId, endpoint: 'https://push.example/ana', p256dh: 'k', auth: 'a' });
    const [old, last] = await db
      .insert(teamMatch)
      .values([
        {
          teamId,
          kind: 'friendly',
          format: 'F11',
          startsAt: new Date('2026-10-01T20:00:00Z'),
          place: 'La 14',
          opponent: 'Viejos',
          createdAt: new Date('2026-09-25T20:00:00Z'),
        },
        {
          teamId,
          kind: 'friendly',
          format: 'F11',
          startsAt: new Date('2026-11-08T20:00:00Z'),
          place: 'La 14',
          opponent: 'Real Bosa',
        },
      ])
      .returning({ id: teamMatch.id });
    await db.insert(matchReply).values([
      { matchId: last!.id, userId: ana.userId, reply: 'yes' },
      { matchId: old!.id, userId: beto.userId, reply: 'yes' },
    ]);
    app = await bootApp(url);
  });

  afterAll(async () => {
    await app?.close();
    await connection?.pool.end();
    vi.unstubAllEnvs();
    await container?.stop();
  });

  const get = (who: SeededUser) =>
    app.inject({
      method: 'GET',
      url: `/api/v1/teams/${teamId}/adoption`,
      headers: { cookie: who.cookie, origin: TEST_ENV.WEB_ORIGIN },
    });

  it('el cuerpo técnico ve quién la usa, sin horas: esta semana o antes', async () => {
    const res = await get(owner);
    expect(res.statusCode).toBe(200);
    const data = AdoptionResponseSchema.parse(res.json());
    expect(data.lastCallUp).toMatchObject({ opponent: 'Real Bosa' });
    expect(data.players).toEqual([
      expect.objectContaining({
        displayName: 'ana',
        seen: 'week',
        notices: true,
        testDone: false,
        repliedLast: true,
      }),
      // Respondió la anterior, no la última.
      expect.objectContaining({
        displayName: 'beto',
        seen: 'older',
        notices: false,
        repliedLast: false,
      }),
      // Lesionado: no tiene que responder.
      expect.objectContaining({ displayName: 'ciro', repliedLast: null }),
    ]);
    expect(JSON.stringify(data)).not.toMatch(/updatedAt|\d{4}-\d{2}-\d{2}T.*seen/);
  });

  it('un jugador no lo ve', async () => {
    expect((await get(ana)).statusCode).toBe(403);
  });
});
