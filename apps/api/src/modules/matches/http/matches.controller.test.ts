import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { MatchListResponseSchema, MatchResponseSchema } from '@sdl/contracts';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createDb, type DbConnection } from '../../../shared/db/client.js';
import { bootApp, TEST_ENV } from '../../../test/app.js';
import { startMigratedPostgres } from '../../../test/postgres.js';
import { seedUserWithSession, type SeededUser } from '../../../test/sessions.js';
import { bootstrapTeam } from '../../teams/infrastructure/bootstrap-team.js';
import { teamMembership } from '../../teams/infrastructure/schema.js';
import { teamMatch } from '../infrastructure/schema.js';

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

describe('partidos: convocar y responder (Fase 7)', () => {
  let container: StartedPostgreSqlContainer;
  let connection: DbConnection;
  let app: NestFastifyApplication;
  let coach: SeededUser, ana: SeededUser, beto: SeededUser, outsider: SeededUser;
  let teamId: string;

  beforeAll(async () => {
    container = await startMigratedPostgres();
    const url = container.getConnectionUri();
    connection = createDb(url);
    const seed = (name: string) => seedUserWithSession(url, { name, email: `${name}@example.com` });
    coach = await seed('coach');
    ana = await seed('ana');
    beto = await seed('beto');
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
    await connection.db.insert(teamMembership).values([
      { teamId, userId: ana.userId, role: 'player', jerseyNumber: 4 },
      { teamId, userId: beto.userId, role: 'player', jerseyNumber: 9 },
    ]);
    app = await bootApp(url);
  });

  afterAll(async () => {
    await app?.close();
    await connection?.pool.end();
    vi.unstubAllEnvs();
    await container?.stop();
  });

  const call = (
    method: 'GET' | 'POST' | 'PATCH' | 'PUT',
    path: string,
    who: SeededUser,
    body?: object,
  ) =>
    app.inject({
      method,
      url: `/api/v1/teams/${teamId}/matches${path}`,
      headers: { cookie: who.cookie, origin: TEST_ENV.WEB_ORIGIN },
      ...(body ? { payload: body } : {}),
    });
  const convocar = (over: object = {}) =>
    call('POST', '', coach, {
      format: 'F11',
      startsAt: inDays(3),
      place: 'Cancha de La 14',
      opponent: 'Los Pibes',
      ...over,
    });

  it('el cuerpo técnico convoca; el equipo lo ve; los jugadores responden', async () => {
    const created = await convocar();
    expect(created.statusCode).toBe(201);
    const { match, roster } = MatchResponseSchema.parse(created.json());
    expect(match).toMatchObject({
      opponent: 'Los Pibes',
      status: 'scheduled',
      open: true,
      replies: { yes: 0, no: 0, pending: 2 },
      createdBy: { name: 'coach' },
      published: null,
    });
    expect(roster!.map((r) => [r.displayName, r.reply])).toEqual([
      ['ana', null],
      ['beto', null],
    ]);

    const voy = await call('PUT', `/${match.id}/reply`, ana, { reply: 'yes' });
    expect(MatchResponseSchema.parse(voy.json())).toMatchObject({
      match: { myReply: 'yes', replies: { yes: 1, no: 0, pending: 1 } },
      // Los compañeros no ven quién respondió qué.
      roster: null,
    });
    await call('PUT', `/${match.id}/reply`, beto, { reply: 'no' });
    // Puede cambiarla hasta la hora del partido.
    await call('PUT', `/${match.id}/reply`, beto, { reply: 'yes' });

    const seen = MatchResponseSchema.parse((await call('GET', `/${match.id}`, coach)).json());
    expect(seen.match.replies).toEqual({ yes: 2, no: 0, pending: 0 });
    expect(seen.roster!.map((r) => r.reply)).toEqual(['yes', 'yes']);

    const list = MatchListResponseSchema.parse((await call('GET', '', ana)).json());
    expect(list.items.map((m) => m.opponent)).toContain('Los Pibes');
  });

  it('reglas: formato del equipo, en el futuro, solo jugadores responden, solo el cuerpo técnico convoca', async () => {
    expect((await convocar({ format: 'F8' })).json()).toMatchObject({
      error: { code: 'FORMAT_NOT_PLAYED' },
    });
    expect((await convocar({ startsAt: inDays(-1) })).json()).toMatchObject({
      error: { code: 'MATCH_IN_PAST' },
    });
    expect(
      (
        await call('POST', '', ana, {
          format: 'F11',
          startsAt: inDays(3),
          place: 'X',
          opponent: 'Y',
        })
      ).statusCode,
    ).toBe(403);
    const { match } = MatchResponseSchema.parse((await convocar()).json());
    expect((await call('PUT', `/${match.id}/reply`, coach, { reply: 'yes' })).statusCode).toBe(403);
    expect((await call('GET', `/${match.id}`, outsider)).statusCode).toBe(403);
  });

  it('cancelado o ya empezado, queda fijo (D17)', async () => {
    const { match } = MatchResponseSchema.parse((await convocar()).json());
    const cancelled = await call('PATCH', `/${match.id}`, coach, { status: 'cancelled' });
    expect(MatchResponseSchema.parse(cancelled.json()).match).toMatchObject({
      status: 'cancelled',
      open: false,
    });
    const late = await call('PUT', `/${match.id}/reply`, ana, { reply: 'yes' });
    expect(late.statusCode).toBe(409);
    expect(late.json()).toMatchObject({ error: { code: 'MATCH_CLOSED' } });

    const { match: other } = MatchResponseSchema.parse((await convocar()).json());
    // El partido empezó (se mueve la hora en la base: el API no deja ponerla en el pasado).
    await connection.db
      .update(teamMatch)
      .set({ startsAt: new Date(Date.now() - 60_000) })
      .where(eq(teamMatch.id, other.id));
    expect((await call('PATCH', `/${other.id}`, coach, { place: 'Otra' })).json()).toMatchObject({
      error: { code: 'MATCH_CLOSED' },
    });
  });
});
