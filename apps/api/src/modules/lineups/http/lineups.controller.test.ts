import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import {
  ErrorBodySchema,
  LineupInputsResponseSchema,
  LineupListResponseSchema,
  LineupResponseSchema,
  POLICY_VERSION,
  QuestionnaireResponseSchema,
  type LineupInput,
} from '@sdl/contracts';
import { FIT_VERSION, findFormation, MODE_WEIGHTS, solveLineup } from '@sdl/domain';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createDb, type DbConnection } from '../../../shared/db/client.js';
import { bootApp, TEST_ENV } from '../../../test/app.js';
import { startMigratedPostgres } from '../../../test/postgres.js';
import { seedUserWithSession, type SeededUser } from '../../../test/sessions.js';
import { ORIENTATION_V1 } from '../../questionnaires/infrastructure/seed/orientation-v1.content.js';
import { ORIENTATION_V2 } from '../../questionnaires/infrastructure/seed/orientation-v2.content.js';
import { seedOrientationContent } from '../../questionnaires/infrastructure/seed/seed-orientation.js';
import { bootstrapTeam } from '../../teams/infrastructure/bootstrap-team.js';
import { teamMembership } from '../../teams/infrastructure/schema.js';

describe('planificador: señales y alineaciones guardadas', () => {
  let container: StartedPostgreSqlContainer;
  let connection: DbConnection;
  let app: NestFastifyApplication;
  let owner: SeededUser, coach: SeededUser, assistant: SeededUser, outsider: SeededUser;
  let players: SeededUser[];
  let teamId: string;

  const call = (
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
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

  const inputs = async (who: SeededUser) =>
    LineupInputsResponseSchema.parse(
      (await call('GET', `/teams/${teamId}/lineup-inputs`, who)).json(),
    );

  /** Arma como el celular: señales del API + solveLineup del dominio. */
  const build = async (name = 'Fecha 1'): Promise<LineupInput> => {
    const data = await inputs(coach);
    const formation = findFormation('1-4-3-3')!;
    const weights = MODE_WEIGHTS.balanced;
    const result = solveLineup({ formation, players: data.players, weights });
    return {
      name,
      matchDate: '2026-11-01',
      formation: formation.key,
      mode: 'balanced',
      weights,
      priority: 'none',
      minKnowledgePct: null,
      fitVersion: FIT_VERSION,
      available: data.players.map((p) => p.playerId),
      pins: [],
      assignments: result.assignments.map((a) => ({ ...a, manual: false })),
      bench: result.bench,
    };
  };

  beforeAll(async () => {
    container = await startMigratedPostgres();
    const url = container.getConnectionUri();
    connection = createDb(url);
    await seedOrientationContent(connection.db, ORIENTATION_V1);
    await seedOrientationContent(connection.db, ORIENTATION_V2);
    const seed = (name: string) => seedUserWithSession(url, { name, email: `${name}@example.com` });
    [owner, coach, assistant, outsider] = [
      await seed('dueno'),
      await seed('profe'),
      await seed('asistente'),
      await seed('otro'),
    ];
    players = [await seed('ana'), await seed('beto'), await seed('caro')];
    ({ teamId } = await bootstrapTeam(connection.db, {
      clubName: 'Los del Barrio',
      clubSlug: 'los-del-barrio',
      teamName: 'Primer equipo',
      format: 'F11',
      season: '2026',
      ownerEmail: 'dueno@example.com',
      coachEmail: 'profe@example.com',
    }));
    await connection.db
      .insert(teamMembership)
      .values([
        { teamId, userId: assistant.userId, role: 'assistant' },
        ...players.map((p) => ({ teamId, userId: p.userId, role: 'player' as const })),
      ]);
    app = await bootApp(url);
    for (const who of [owner, coach, assistant, ...players]) {
      await call('POST', '/me/consent', who, { policyVersion: POLICY_VERSION, ageConfirmed: true });
    }
    // Ana hace el test.
    const ana = players[0]!;
    const q = QuestionnaireResponseSchema.parse(
      (await call('GET', '/questionnaires/current', ana)).json(),
    );
    await call('POST', '/attempts', ana, {
      clientAttemptId: randomUUID(),
      teamId,
      questionnaireVersionId: q.versionId,
      format: 'F11',
      startedAt: new Date(Date.now() - 60_000).toISOString(),
      submittedAt: new Date().toISOString(),
      positionItems: q.positionItems.slice(0, q.positionItemsPerAttempt).map((item, i) => ({
        itemId: item.id,
        shownOrder: i + 1,
        optionOrder: item.options.map((o) => o.id),
        answerOptionId: item.options[0]!.id,
      })),
    });
    // Beto tiene tarjeta.
    await call('POST', `/teams/${teamId}/players/${players[1]!.userId}/ratings`, coach, {
      values: { PAC: 80, SHO: 60, PAS: 70, DRI: 75, DEF: 40, PHY: 65 },
    });
  });

  afterAll(async () => {
    await app?.close();
    await connection?.pool.end();
    vi.unstubAllEnvs();
    await container?.stop();
  });

  it('las señales respetan la regla a ciegas: el test de Ana viaja solo tras valorarla', async () => {
    const [ana] = players;
    const before = await inputs(coach);
    expect(before.format).toBe('F11');
    const anaBefore = before.players.find((p) => p.playerId === ana!.userId)!;
    expect(anaBefore.affinity).toBeUndefined();
    // El admin del club no valora: la ve.
    expect(
      (await inputs(owner)).players.find((p) => p.playerId === ana!.userId)!.affinity,
    ).toBeDefined();
    // Beto trae su tarjeta como medias por posición.
    expect(before.players.find((p) => p.playerId === players[1]!.userId)!.rating?.EXT).toBe(74);

    await call('POST', `/teams/${teamId}/assessments`, coach, {
      playerId: ana!.userId,
      primaryPosition: 'DFC',
      secondaryPositions: [],
      confidence: 4,
    });
    const after = (await inputs(coach)).players.find((p) => p.playerId === ana!.userId)!;
    expect(Object.keys(after.affinity!)).toHaveLength(8);
    expect(after.assessment).toEqual({ primary: 'DFC', secondary: [] });
  });

  it('guardar, listar, ver, editar y borrar una alineación', async () => {
    const body = await build();
    const res = await call('POST', `/teams/${teamId}/lineups`, coach, body);
    expect(res.statusCode).toBe(201);
    const { lineup } = LineupResponseSchema.parse(res.json());
    expect(lineup).toMatchObject({
      name: 'Fecha 1',
      format: 'F11',
      formation: '1-4-3-3',
      fitVersion: FIT_VERSION,
    });
    expect(lineup.assignments.find((a) => a.slotId === 'DFC-1')!.playerId).toBe(players[0]!.userId);

    const list = LineupListResponseSchema.parse(
      (await call('GET', `/teams/${teamId}/lineups`, owner)).json(),
    );
    expect(list.items.map((l) => l.name)).toEqual(['Fecha 1']);

    const edited = await call('PUT', `/teams/${teamId}/lineups/${lineup.id}`, assistant, {
      ...body,
      name: 'Fecha 1 (con cambios)',
    });
    expect(LineupResponseSchema.parse(edited.json()).lineup.name).toBe('Fecha 1 (con cambios)');
    expect((await call('GET', `/teams/${teamId}/lineups/${lineup.id}`, owner)).statusCode).toBe(
      200,
    );

    expect((await call('DELETE', `/teams/${teamId}/lineups/${lineup.id}`, coach)).statusCode).toBe(
      204,
    );
    expect((await call('GET', `/teams/${teamId}/lineups/${lineup.id}`, coach)).statusCode).toBe(
      404,
    );
  });

  it('valida la foto: formación del formato, jugadores del equipo, sin repetidos ni puestos de más', async () => {
    const body = await build();
    const code = async (payload: object) =>
      ErrorBodySchema.parse((await call('POST', `/teams/${teamId}/lineups`, coach, payload)).json())
        .error.code;

    expect(await code({ ...body, formation: '9-9-9' })).toBe('FORMATION_INVALID');
    expect(await code({ ...body, available: [...body.available, outsider.userId] })).toBe(
      'PLAYER_NOT_IN_TEAM',
    );
    const someone = body.assignments.find((a) => a.playerId)!.playerId!;
    expect(await code({ ...body, bench: [...body.bench, someone] })).toBe('LINEUP_INVALID');
    expect(await code({ ...body, assignments: body.assignments.slice(1) })).toBe('LINEUP_INVALID');
    // Fijar a Beto en el puesto donde quedó Ana: no está ahí.
    const anaSlot = body.assignments.find((a) => a.playerId === players[0]!.userId)!.slotId;
    expect(await code({ ...body, pins: [{ slotId: anaSlot, playerId: players[1]!.userId }] })).toBe(
      'LINEUP_INVALID',
    );
  });

  it('el admin del club ve pero no guarda; jugadores y de afuera no entran', async () => {
    const body = await build();
    expect((await call('POST', `/teams/${teamId}/lineups`, owner, body)).statusCode).toBe(403);
    expect((await call('GET', `/teams/${teamId}/lineup-inputs`, players[0]!)).statusCode).toBe(403);
    expect((await call('GET', `/teams/${teamId}/lineups`, outsider)).statusCode).toBe(403);
  });

  it('un equipo de F11 puede guardar una alineación de F8 (juega los dos formatos)', async () => {
    const data = await inputs(coach);
    const formation = findFormation('1-3-3-1')!;
    const result = solveLineup({
      formation,
      players: data.players,
      weights: MODE_WEIGHTS.balanced,
    });
    const res = await call('POST', `/teams/${teamId}/lineups`, coach, {
      ...(await build('Torneo de F8')),
      formation: formation.key,
      assignments: result.assignments.map((a) => ({ ...a, manual: false })),
      bench: result.bench,
    });
    expect(res.statusCode).toBe(201);
    expect(LineupResponseSchema.parse(res.json()).lineup).toMatchObject({
      format: 'F8',
      formation: '1-3-3-1',
    });
  });
});
