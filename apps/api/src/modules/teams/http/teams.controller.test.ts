import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { ErrorBodySchema, TeamResponseSchema } from '@sdl/contracts';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createDb, type DbConnection } from '../../../shared/db/client.js';
import { bootApp, TEST_ENV } from '../../../test/app.js';
import { startMigratedPostgres } from '../../../test/postgres.js';
import { seedUserWithSession, type SeededUser } from '../../../test/sessions.js';
import { bootstrapTeam } from '../infrastructure/bootstrap-team.js';
import { teamMembership } from '../infrastructure/schema.js';

describe('GET /api/v1/teams/:teamId', () => {
  let container: StartedPostgreSqlContainer;
  let connection: DbConnection;
  let app: NestFastifyApplication;
  let owner: SeededUser, coach: SeededUser, player: SeededUser, formerPlayer: SeededUser;
  let outsider: SeededUser;
  let teamId: string, otherTeamId: string;

  beforeAll(async () => {
    container = await startMigratedPostgres();
    const url = container.getConnectionUri();
    connection = createDb(url);
    const seed = (name: string) => seedUserWithSession(url, { name, email: `${name}@example.com` });
    owner = await seed('owner');
    coach = await seed('coach');
    player = await seed('player');
    formerPlayer = await seed('former');
    outsider = await seed('outsider');

    const base = { clubName: 'Los del Barrio', clubSlug: 'los-del-barrio', format: 'F11' as const };
    ({ teamId } = await bootstrapTeam(connection.db, {
      ...base,
      teamName: 'Primer equipo',
      season: '2026',
      ownerEmail: 'owner@example.com',
      coachEmail: 'coach@example.com',
    }));
    // Otro club, con el "outsider" de entrenador.
    ({ teamId: otherTeamId } = await bootstrapTeam(connection.db, {
      clubName: 'Otro club',
      clubSlug: 'otro-club',
      format: 'F8',
      teamName: 'Veteranos',
      season: '2026',
      ownerEmail: 'outsider@example.com',
      coachEmail: 'outsider@example.com',
    }));
    await connection.db.insert(teamMembership).values([
      { teamId, userId: player.userId, role: 'player' },
      { teamId, userId: formerPlayer.userId, role: 'player', leftAt: new Date() },
    ]);

    app = await bootApp(url);
  });

  afterAll(async () => {
    await app?.close();
    await connection?.pool.end();
    vi.unstubAllEnvs();
    await container?.stop();
  });

  const get = (id: string, who?: SeededUser) =>
    app.inject({
      method: 'GET',
      url: `/api/v1/teams/${id}`,
      ...(who ? { headers: { cookie: who.cookie } } : {}),
    });

  it('el entrenador ve el equipo y sus roles', async () => {
    const res = await get(teamId, coach);
    expect(res.statusCode).toBe(200);
    expect(TeamResponseSchema.parse(res.json())).toEqual({
      team: {
        id: teamId,
        name: 'Primer equipo',
        format: 'F11',
        formats: ['F11'],
        season: '2026',
        club: { id: expect.any(String), name: 'Los del Barrio' },
        ratingsVisibleToPlayers: true,
        matchRatingsVisibleToPlayers: true,
      },
      myRoles: ['coach'],
    });
  });

  const patch = (id: string, who: SeededUser, body: object) =>
    app.inject({
      method: 'PATCH',
      url: `/api/v1/teams/${id}`,
      headers: { cookie: who.cookie, origin: TEST_ENV.WEB_ORIGIN },
      payload: body,
    });

  it('datos del equipo: nombre y formatos en que juega, con el principal entre ellos (D14)', async () => {
    const both = await patch(teamId, coach, { name: '  Primer equipo A ', formats: ['F11', 'F8'] });
    expect(both.statusCode).toBe(200);
    expect(TeamResponseSchema.parse(both.json()).team).toMatchObject({
      name: 'Primer equipo A',
      format: 'F11',
      formats: ['F11', 'F8'],
    });
    expect((await get(teamId, coach)).json()).toMatchObject({
      team: { name: 'Primer equipo A', formats: ['F11', 'F8'] },
    });

    // El principal tiene que ser uno de los que juega.
    const orphan = await patch(teamId, coach, { formats: ['F8'] });
    expect(orphan.statusCode).toBe(422);
    expect(orphan.json()).toMatchObject({ error: { code: 'TEAM_FORMAT_NOT_PLAYED' } });
    const switched = await patch(teamId, coach, { format: 'F8', formats: ['F8'] });
    expect(switched.json()).toMatchObject({ team: { format: 'F8', formats: ['F8'] } });

    // Lo deja como estaba para los demás tests.
    await patch(teamId, coach, { name: 'Primer equipo', format: 'F11', formats: ['F11'] });
  });

  it('datos del equipo: nombre repetido en el club, vacío o sin permiso', async () => {
    // Otro equipo del mismo club y temporada.
    await bootstrapTeam(connection.db, {
      clubName: 'Los del Barrio',
      clubSlug: 'los-del-barrio',
      format: 'F8',
      teamName: 'Los del jueves',
      season: '2026',
      ownerEmail: 'owner@example.com',
      coachEmail: 'coach@example.com',
    });
    const taken = await patch(teamId, coach, { name: 'Los del jueves' });
    expect(taken.statusCode).toBe(409);
    expect(taken.json()).toMatchObject({ error: { code: 'TEAM_NAME_TAKEN' } });
    expect((await patch(teamId, coach, {})).statusCode).toBe(400);
    expect((await patch(teamId, coach, { formats: ['F8', 'F8'] })).statusCode).toBe(400);
    expect((await patch(teamId, player, { name: 'Otro' })).statusCode).toBe(403);
  });

  it('un jugador activo lo ve; uno que ya salió del equipo no', async () => {
    expect((await get(teamId, player)).json()).toMatchObject({ myRoles: ['player'] });
    expect((await get(teamId, formerPlayer)).statusCode).toBe(403);
  });

  it('el dueño del club lo ve aunque no sea miembro del equipo', async () => {
    const res = await get(teamId, owner);
    expect(res.statusCode).toBe(200);
    expect(res.json()).toMatchObject({ myRoles: [] });
  });

  it('alguien de otro club recibe 403 con el formato común', async () => {
    const res = await get(teamId, outsider);
    expect(res.statusCode).toBe(403);
    expect(ErrorBodySchema.parse(res.json()).error.code).toBe('FORBIDDEN');
    expect((await get(otherTeamId, coach)).statusCode).toBe(403);
  });

  it('equipo inexistente o id mal formado → 404', async () => {
    expect((await get('0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f70', coach)).statusCode).toBe(404);
    expect((await get('no-es-un-uuid', coach)).statusCode).toBe(404);
  });

  it('sin sesión → 401 antes de mirar permisos', async () => {
    expect((await get(teamId)).statusCode).toBe(401);
  });

  it('el script de alta es idempotente', async () => {
    const again = await bootstrapTeam(connection.db, {
      clubName: 'Los del Barrio',
      clubSlug: 'los-del-barrio',
      format: 'F11',
      teamName: 'Primer equipo',
      season: '2026',
      ownerEmail: 'owner@example.com',
      coachEmail: 'COACH@example.com',
    });
    expect(again.teamId).toBe(teamId);
    const coaches = await connection.db
      .select()
      .from(teamMembership)
      .where(eq(teamMembership.teamId, teamId));
    expect(coaches.filter((m) => m.role === 'coach')).toHaveLength(1);
  });

  it('el script exige que las personas hayan entrado antes', async () => {
    await expect(
      bootstrapTeam(connection.db, {
        clubName: 'Nuevo',
        clubSlug: 'nuevo',
        format: 'F8',
        teamName: 'A',
        season: '2026',
        ownerEmail: 'owner@example.com',
        coachEmail: 'nadie@example.com',
      }),
    ).rejects.toThrow(/nadie@example.com/);
  });
});
