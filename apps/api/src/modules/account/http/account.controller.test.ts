import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { MyDataExportSchema, POLICY_VERSION } from '@sdl/contracts';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createDb, type DbConnection } from '../../../shared/db/client.js';
import { bootApp, TEST_ENV } from '../../../test/app.js';
import { startMigratedPostgres } from '../../../test/postgres.js';
import { seedUserWithSession, type SeededUser } from '../../../test/sessions.js';
import { coachAssessment } from '../../assessments/infrastructure/schema.js';
import { dataConsent } from '../../identity/infrastructure/consent.schema.js';
import { user } from '../../identity/infrastructure/schema.js';
import { playerRating, playerRatingValue } from '../../ratings/infrastructure/schema.js';
import { bootstrapTeam } from '../../teams/infrastructure/bootstrap-team.js';
import { teamMembership } from '../../teams/infrastructure/schema.js';

describe('tus datos: descargar y eliminar la cuenta (`04` §5)', () => {
  let container: StartedPostgreSqlContainer;
  let connection: DbConnection;
  let app: NestFastifyApplication;
  let owner: SeededUser, assistant: SeededUser, ana: SeededUser;
  let teamId: string;
  let ratingId: string;

  beforeAll(async () => {
    container = await startMigratedPostgres();
    const url = container.getConnectionUri();
    connection = createDb(url);
    const seed = (name: string) => seedUserWithSession(url, { name, email: `${name}@example.com` });
    owner = await seed('owner');
    assistant = await seed('asistente');
    ana = await seed('ana');
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
      { teamId, userId: assistant.userId, role: 'assistant' },
    ]);
    await db
      .insert(dataConsent)
      .values({ userId: ana.userId, policyVersion: POLICY_VERSION, ageConfirmed: true });
    await db.insert(coachAssessment).values({
      teamId,
      playerUserId: ana.userId,
      coachUserId: assistant.userId,
      primaryPosition: 'DFC',
      secondaryPositions: ['LAT'],
      confidence: 4,
      blind: true,
      notes: 'Gana por arriba',
    });
    const [rating] = await db
      .insert(playerRating)
      .values({
        teamId,
        playerUserId: ana.userId,
        ratedBy: assistant.userId,
        notes: 'Mejoró el pase',
      })
      .returning({ id: playerRating.id });
    ratingId = rating!.id;
    await db.insert(playerRatingValue).values([
      { ratingId, attributeCode: 'PAC', value: 70 },
      { ratingId, attributeCode: 'DEF', value: 80 },
    ]);
    app = await bootApp(url);
  });

  afterAll(async () => {
    await app?.close();
    await connection?.pool.end();
    vi.unstubAllEnvs();
    await container?.stop();
  });

  const call = (method: 'GET' | 'DELETE', path: string, who: SeededUser, body?: object) =>
    app.inject({
      method,
      url: `/api/v1${path}`,
      headers: { cookie: who.cookie, origin: TEST_ENV.WEB_ORIGIN },
      ...(body ? { payload: body } : {}),
    });

  it('descargar: todo lo suyo, también lo que el cuerpo técnico registró sobre ella', async () => {
    const res = await call('GET', '/me/export', ana);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-disposition']).toContain('mis-datos-siempre-de-local.json');
    expect(res.headers['cache-control']).toBe('no-store');
    const data = MyDataExportSchema.parse(res.json());
    expect(data.account).toMatchObject({ name: 'ana', email: 'ana@example.com' });
    expect(data.consents).toEqual([
      expect.objectContaining({ policyVersion: POLICY_VERSION, revokedAt: null }),
    ]);
    expect(data.memberships).toMatchObject({
      teams: [{ team: { name: 'Primer equipo' }, roles: ['player'] }],
    });
    expect(data.cards).toEqual([
      expect.objectContaining({
        team: 'Primer equipo',
        ratedBy: 'asistente',
        notes: 'Mejoró el pase',
        values: { PAC: 70, DEF: 80 },
      }),
    ]);
    expect(data.assessments).toEqual([
      expect.objectContaining({
        by: 'asistente',
        primaryPosition: 'DFC',
        blind: true,
        notes: 'Gana por arriba',
      }),
    ]);
  });

  it('eliminar exige escribir ELIMINAR', async () => {
    expect((await call('DELETE', '/me', ana)).statusCode).toBe(400);
    expect((await call('DELETE', '/me', ana, { confirmation: 'eliminar' })).statusCode).toBe(400);
  });

  it('el único dueño de un club no puede irse sin dejar a otro', async () => {
    const res = await call('DELETE', '/me', owner, { confirmation: 'ELIMINAR' });
    expect(res.statusCode).toBe(409);
    expect(res.json()).toMatchObject({
      error: { code: 'LAST_CLUB_ADMIN', details: { clubs: ['Los del Barrio'] } },
    });
  });

  it('al eliminarla se va todo lo suyo; lo que hizo sobre otros queda sin autor', async () => {
    // El asistente se va: la tarjeta que puntuó a Ana queda, sin su nombre.
    expect((await call('DELETE', '/me', assistant, { confirmation: 'ELIMINAR' })).statusCode).toBe(
      204,
    );
    const [card] = await connection.db
      .select()
      .from(playerRating)
      .where(eq(playerRating.id, ratingId));
    expect(card).toMatchObject({ ratedBy: null, notes: 'Mejoró el pase' });

    // Ana se va: su cuenta, su sesión, su tarjeta y lo demás.
    expect((await call('DELETE', '/me', ana, { confirmation: 'ELIMINAR' })).statusCode).toBe(204);
    expect(await connection.db.select().from(user).where(eq(user.id, ana.userId))).toEqual([]);
    expect(
      await connection.db
        .select()
        .from(playerRating)
        .where(eq(playerRating.playerUserId, ana.userId)),
    ).toEqual([]);
    expect(
      await connection.db
        .select()
        .from(coachAssessment)
        .where(eq(coachAssessment.playerUserId, ana.userId)),
    ).toEqual([]);
    expect((await call('GET', '/me', ana)).statusCode).toBe(401);
  });
});
