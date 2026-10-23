import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { MeResponseSchema, ProfileResponseSchema, TeamResponseSchema } from '@sdl/contracts';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { POLICY_VERSION } from '@sdl/contracts';
import { createDb, type DbConnection } from '../../../shared/db/client.js';
import { bootApp, TEST_ENV } from '../../../test/app.js';
import { startMigratedPostgres } from '../../../test/postgres.js';
import { seedUserWithSession, type SeededUser } from '../../../test/sessions.js';
import { dataConsent } from '../../identity/infrastructure/consent.schema.js';
import { bootstrapTeam } from '../../teams/infrastructure/bootstrap-team.js';
import { teamMembership } from '../../teams/infrastructure/schema.js';

/** Un WebP mínimo con un bloque EXIF (la "ubicación" de la cámara). */
function webpWithGps() {
  const chunk = (fourcc: string, data: Buffer) => {
    const h = Buffer.alloc(8);
    h.write(fourcc, 0, 'ascii');
    h.writeUInt32LE(data.length, 4);
    return Buffer.concat([h, data, data.length % 2 ? Buffer.alloc(1) : Buffer.alloc(0)]);
  };
  const body = Buffer.concat([
    chunk('VP8 ', Buffer.from('imagen')),
    chunk('EXIF', Buffer.from('GPS 4.6 -74.0')),
  ]);
  const h = Buffer.alloc(12);
  h.write('RIFF', 0, 'ascii');
  h.writeUInt32LE(body.length + 4, 4);
  h.write('WEBP', 8, 'ascii');
  return Buffer.concat([h, body]);
}

describe('fotos del jugador y del equipo (ADR-09)', () => {
  let container: StartedPostgreSqlContainer;
  let connection: DbConnection;
  let app: NestFastifyApplication;
  let coach: SeededUser, ana: SeededUser, outsider: SeededUser;
  let teamId: string;

  beforeAll(async () => {
    container = await startMigratedPostgres();
    const url = container.getConnectionUri();
    connection = createDb(url);
    const seed = (name: string) => seedUserWithSession(url, { name, email: `${name}@example.com` });
    coach = await seed('coach');
    ana = await seed('ana');
    outsider = await seed('outsider');
    ({ teamId } = await bootstrapTeam(connection.db, {
      clubName: 'Los del Barrio',
      clubSlug: 'los-del-barrio',
      format: 'F11',
      teamName: 'Primer equipo',
      season: '2026',
      ownerEmail: 'coach@example.com',
      coachEmail: 'coach@example.com',
    }));
    await connection.db
      .insert(teamMembership)
      .values({ teamId, userId: ana.userId, role: 'player' });
    await connection.db.insert(dataConsent).values(
      [coach, ana, outsider].map((u) => ({
        userId: u.userId,
        policyVersion: POLICY_VERSION,
        ageConfirmed: true,
      })),
    );
    app = await bootApp(url);
  });

  afterAll(async () => {
    await app?.close();
    await connection?.pool.end();
    vi.unstubAllEnvs();
    await container?.stop();
  });

  const call = (
    method: 'GET' | 'PUT' | 'DELETE',
    url: string,
    who: SeededUser,
    body?: Buffer,
    type = 'image/webp',
  ) =>
    app.inject({
      method,
      url: `/api/v1${url}`,
      headers: {
        cookie: who.cookie,
        origin: TEST_ENV.WEB_ORIGIN,
        ...(body ? { 'content-type': type } : {}),
      },
      ...(body ? { payload: body } : {}),
    });

  it('el jugador sube su foto: se guarda sin metadatos y la ve su equipo, nadie más', async () => {
    const res = await call('PUT', '/me/photo', ana, webpWithGps());
    expect(res.statusCode).toBe(200);
    const { profile } = ProfileResponseSchema.parse(res.json());
    expect(profile.photoUrl).toMatch(new RegExp(`^/api/v1/players/${ana.userId}/photo\\?v=`));

    const me = MeResponseSchema.parse((await call('GET', '/me', ana)).json());
    expect(me.profile.photoUrl).toBe(profile.photoUrl);

    const fromCoach = await call('GET', `/players/${ana.userId}/photo`, coach);
    expect(fromCoach.statusCode).toBe(200);
    expect(fromCoach.headers['content-type']).toBe('image/webp');
    expect(fromCoach.headers['cache-control']).toContain('private');
    expect(fromCoach.rawPayload.includes(Buffer.from('GPS'))).toBe(false);
    expect(fromCoach.rawPayload.includes(Buffer.from('imagen'))).toBe(true);

    expect((await call('GET', `/players/${ana.userId}/photo`, outsider)).statusCode).toBe(404);
  });

  it('cambiarla da otra URL; quitarla la borra', async () => {
    const first = ProfileResponseSchema.parse(
      (await call('PUT', '/me/photo', ana, webpWithGps())).json(),
    );
    const second = ProfileResponseSchema.parse(
      (await call('PUT', '/me/photo', ana, webpWithGps())).json(),
    );
    expect(second.profile.photoUrl).not.toBe(first.profile.photoUrl);
    const removed = ProfileResponseSchema.parse((await call('DELETE', '/me/photo', ana)).json());
    expect(removed.profile.photoUrl).toBeNull();
    expect((await call('GET', `/players/${ana.userId}/photo`, coach)).statusCode).toBe(404);
  });

  it('rechaza lo que no es WebP ni JPEG', async () => {
    const svg = await call('PUT', '/me/photo', ana, Buffer.from('<svg/>'), 'image/webp');
    expect(svg.statusCode).toBe(422);
    expect(svg.json()).toMatchObject({ error: { code: 'PHOTO_INVALID' } });
  });

  it('el escudo del equipo: lo pone el coach, lo ve el equipo, no lo cambia un jugador', async () => {
    const res = await call('PUT', `/teams/${teamId}/photo`, coach, webpWithGps());
    expect(res.statusCode).toBe(200);
    const { team } = TeamResponseSchema.parse(res.json());
    expect(team.photoUrl).toMatch(new RegExp(`^/api/v1/teams/${teamId}/photo\\?v=`));
    expect((await call('GET', `/teams/${teamId}/photo`, ana)).statusCode).toBe(200);
    expect((await call('GET', `/teams/${teamId}/photo`, outsider)).statusCode).toBe(403);
    expect((await call('PUT', `/teams/${teamId}/photo`, ana, webpWithGps())).statusCode).toBe(403);
    const me = MeResponseSchema.parse((await call('GET', '/me', ana)).json());
    expect(me.teams[0]!.team.photoUrl).toBe(team.photoUrl);
  });
});
