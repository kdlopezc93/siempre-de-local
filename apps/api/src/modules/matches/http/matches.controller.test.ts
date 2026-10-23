import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import {
  MatchListResponseSchema,
  MatchRatingsResponseSchema,
  MatchResponseSchema,
  PlayerMatchRatingsResponseSchema,
} from '@sdl/contracts';
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
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
    path: string,
    who: SeededUser,
    body?: object,
    base = `/teams/${teamId}/matches`,
  ) =>
    app.inject({
      method,
      url: `/api/v1${base}${path}`,
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

  it('después del partido: resultado, figura y evaluaciones (D18)', async () => {
    const { match } = MatchResponseSchema.parse((await convocar()).json());
    const early = await call('PUT', `/${match.id}/result`, coach, {
      goalsFor: 2,
      goalsAgainst: 1,
      figurePlayerId: null,
    });
    expect(early.statusCode).toBe(409);
    expect(early.json()).toMatchObject({ error: { code: 'MATCH_NOT_STARTED' } });
    expect(
      (await call('PUT', `/${match.id}/ratings/${ana.userId}`, coach, { rating: 4 })).statusCode,
    ).toBe(409);

    await connection.db
      .update(teamMatch)
      .set({ startsAt: new Date(Date.now() - 60_000) })
      .where(eq(teamMatch.id, match.id));

    // El resultado lo carga el cuerpo técnico; la figura tiene que ser del equipo.
    const result = { goalsFor: 2, goalsAgainst: 1, figurePlayerId: ana.userId };
    expect((await call('PUT', `/${match.id}/result`, ana, result)).statusCode).toBe(403);
    expect(
      (
        await call('PUT', `/${match.id}/result`, coach, {
          ...result,
          figurePlayerId: outsider.userId,
        })
      ).json(),
    ).toMatchObject({ error: { code: 'PLAYER_NOT_IN_TEAM' } });
    const saved = MatchResponseSchema.parse(
      (await call('PUT', `/${match.id}/result`, coach, result)).json(),
    );
    expect(saved.match.result).toMatchObject({
      goalsFor: 2,
      goalsAgainst: 1,
      figure: { id: ana.userId, displayName: 'ana', jerseyNumber: 4 },
    });

    // Evaluaciones de 1 a 5, una por jugador; la nota es del cuerpo técnico.
    expect(
      (await call('PUT', `/${match.id}/ratings/${ana.userId}`, coach, { rating: 6 })).statusCode,
    ).toBe(400);
    expect(
      (await call('PUT', `/${match.id}/ratings/${outsider.userId}`, coach, { rating: 3 })).json(),
    ).toMatchObject({ error: { code: 'PLAYER_NOT_IN_TEAM' } });
    expect(
      (await call('PUT', `/${match.id}/ratings/${beto.userId}`, ana, { rating: 1 })).statusCode,
    ).toBe(403);
    await call('PUT', `/${match.id}/ratings/${beto.userId}`, coach, { rating: 3 });
    await call('PUT', `/${match.id}/ratings/${ana.userId}`, coach, { rating: 5, note: ' Golazo ' });
    const corrected = await call('PUT', `/${match.id}/ratings/${beto.userId}`, coach, {
      rating: 2,
      note: '',
    });
    expect(MatchRatingsResponseSchema.parse(corrected.json()).items).toMatchObject([
      { displayName: 'ana', rating: 5, note: 'Golazo', ratedBy: { name: 'coach' } },
      { displayName: 'beto', rating: 2, note: null },
    ]);
    expect((await call('GET', `/${match.id}/ratings`, ana)).statusCode).toBe(403);

    // Cada jugador ve la suya, sin nota, si el equipo las muestra (por defecto, sí).
    const seen = MatchResponseSchema.parse((await call('GET', `/${match.id}`, ana)).json());
    expect(seen.match).toMatchObject({ myRating: 5, result: { goalsFor: 2 } });
    const betoList = MatchListResponseSchema.parse((await call('GET', '', beto)).json());
    expect(betoList.items.find((m) => m.id === match.id)!.myRating).toBe(2);
    expect(
      (await call('PATCH', '', coach, { matchRatingsVisibleToPlayers: false }, `/teams/${teamId}`))
        .statusCode,
    ).toBe(200);
    const hidden = MatchResponseSchema.parse((await call('GET', `/${match.id}`, ana)).json());
    expect(hidden.match).toMatchObject({ myRating: null, result: { goalsFor: 2 } });
    await call('PATCH', '', coach, { matchRatingsVisibleToPlayers: true }, `/teams/${teamId}`);

    // Al final no jugó: se le quita.
    const removed = await call('DELETE', `/${match.id}/ratings/${beto.userId}`, coach);
    expect(MatchRatingsResponseSchema.parse(removed.json()).items).toHaveLength(1);

    // Partido a partido, en la ficha del jugador (cuerpo técnico).
    const history = await call(
      'GET',
      '',
      coach,
      undefined,
      `/teams/${teamId}/players/${ana.userId}/match-ratings`,
    );
    expect(PlayerMatchRatingsResponseSchema.parse(history.json()).items).toEqual([
      expect.objectContaining({
        matchId: match.id,
        opponent: 'Los Pibes',
        rating: 5,
        note: 'Golazo',
      }),
    ]);
    expect(
      (
        await call(
          'GET',
          '',
          ana,
          undefined,
          `/teams/${teamId}/players/${ana.userId}/match-ratings`,
        )
      ).statusCode,
    ).toBe(403);

    // Y en Tus datos.
    const exported = await call('GET', '', ana, undefined, '/me/export');
    expect(exported.json().matches).toContainEqual(
      expect.objectContaining({
        opponent: 'Los Pibes',
        rating: 5,
        note: 'Golazo',
        ratedBy: 'coach',
      }),
    );
  });
});
