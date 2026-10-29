import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { ErrorBodySchema, POLICY_VERSION, TeamMembersResponseSchema } from '@sdl/contracts';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createDb, type DbConnection } from '../../../shared/db/client.js';
import { bootApp, TEST_ENV } from '../../../test/app.js';
import { startMigratedPostgres } from '../../../test/postgres.js';
import { seedUserWithSession, type SeededUser } from '../../../test/sessions.js';
import { bootstrapTeam } from '../infrastructure/bootstrap-team.js';
import { teamMembership } from '../infrastructure/schema.js';

describe('roles en el equipo y pasar el mando (2026-10-29)', () => {
  let container: StartedPostgreSqlContainer;
  let connection: DbConnection;
  let app: NestFastifyApplication;
  let owner: SeededUser, coach: SeededUser, ana: SeededUser, beto: SeededUser;
  let outsider: SeededUser;
  let teamId: string;

  const call = (
    method: 'GET' | 'PATCH' | 'PUT' | 'POST',
    path: string,
    who: SeededUser,
    payload?: object,
  ) =>
    app.inject({
      method,
      url: `/api/v1${path}`,
      headers: { cookie: who.cookie, origin: TEST_ENV.WEB_ORIGIN },
      ...(payload ? { payload } : {}),
    });
  const roles = (who: SeededUser, userId: string, payload: object) =>
    call('PATCH', `/teams/${teamId}/members/${userId}/roles`, who, payload);
  const members = async () => {
    const { staff, players } = TeamMembersResponseSchema.parse(
      (await call('GET', `/teams/${teamId}/members`, coach)).json(),
    );
    return {
      staff: Object.fromEntries(staff.map((s) => [s.displayName, s.role])),
      players: players.map((p) => p.displayName).sort(),
    };
  };
  const code = (res: { json: () => unknown }) => ErrorBodySchema.parse(res.json()).error.code;

  beforeAll(async () => {
    container = await startMigratedPostgres();
    const url = container.getConnectionUri();
    connection = createDb(url);
    const seed = (name: string) => seedUserWithSession(url, { name, email: `${name}@example.com` });
    [owner, coach, ana, beto, outsider] = [
      await seed('dueno'),
      await seed('profe'),
      await seed('ana'),
      await seed('beto'),
      await seed('otro'),
    ];
    ({ teamId } = await bootstrapTeam(connection.db, {
      clubName: 'Los del Barrio',
      clubSlug: 'los-del-barrio',
      teamName: 'Primer equipo',
      format: 'F8',
      season: '2026',
      ownerEmail: 'dueno@example.com',
      coachEmail: 'profe@example.com',
    }));
    await connection.db.insert(teamMembership).values([
      { teamId, userId: ana.userId, role: 'player', jerseyNumber: 10 },
      { teamId, userId: beto.userId, role: 'player' },
    ]);
    app = await bootApp(url);
    for (const who of [owner, coach, ana, beto]) {
      await call('POST', '/me/consent', who, { policyVersion: POLICY_VERSION, ageConfirmed: true });
    }
  });

  afterAll(async () => {
    await app?.close();
    await connection?.pool.end();
    vi.unstubAllEnvs();
    await container?.stop();
  });

  it('el entrenador sube a una jugadora a asistente y ella sigue jugando', async () => {
    expect((await roles(coach, ana.userId, { assistant: true })).statusCode).toBe(204);
    expect(await members()).toEqual({
      staff: { profe: 'coach', ana: 'assistant' },
      players: ['ana', 'beto'],
    });
    // De asistente no arma el cuerpo técnico.
    expect((await roles(ana, beto.userId, { assistant: true })).statusCode).toBe(403);
  });

  it('el entrenador también puede jugar; asistente no, ya es del cuerpo técnico', async () => {
    expect((await roles(coach, coach.userId, { player: true })).statusCode).toBe(204);
    expect((await members()).players).toContain('profe');
    const res = await roles(coach, coach.userId, { assistant: true });
    expect(res.statusCode).toBe(422);
    expect(code(res)).toBe('COACH_CANNOT_BE_ASSISTANT');
  });

  it('valida: queda con algún rol, está en el equipo, algo que cambiar, y quién puede', async () => {
    const empty = await roles(coach, beto.userId, { player: false });
    expect(empty.statusCode).toBe(422);
    expect(code(empty)).toBe('MEMBER_NEEDS_ROLE');
    const away = await roles(coach, outsider.userId, { player: true });
    expect(away.statusCode).toBe(404);
    expect(code(away)).toBe('MEMBER_NOT_IN_TEAM');
    expect((await roles(coach, beto.userId, {})).statusCode).toBe(400);
    expect((await roles(beto, beto.userId, { assistant: true })).statusCode).toBe(403);
    expect((await roles(outsider, beto.userId, { assistant: true })).statusCode).toBe(403);
  });

  it('deja de jugar y vuelve con su dorsal', async () => {
    expect((await roles(owner, ana.userId, { player: false })).statusCode).toBe(204);
    expect((await members()).players).not.toContain('ana');
    expect((await roles(owner, ana.userId, { player: true })).statusCode).toBe(204);
    const { players } = TeamMembersResponseSchema.parse(
      (await call('GET', `/teams/${teamId}/members`, coach)).json(),
    );
    expect(players.find((p) => p.userId === ana.userId)?.jerseyNumber).toBe(10);
  });

  it('pasar el mando: el anterior queda de asistente; el admin del club también puede', async () => {
    const transfer = (who: SeededUser, userId: string) =>
      call('PUT', `/teams/${teamId}/coach`, who, { userId });
    expect((await transfer(ana, beto.userId)).statusCode).toBe(403);
    expect((await transfer(coach, outsider.userId)).statusCode).toBe(404);

    expect((await transfer(coach, ana.userId)).statusCode).toBe(204);
    expect(await members()).toEqual({
      staff: { profe: 'assistant', ana: 'coach' },
      players: ['ana', 'beto', 'profe'],
    });
    // Ya no es entrenador: no arma el cuerpo técnico.
    expect((await roles(coach, beto.userId, { assistant: true })).statusCode).toBe(403);

    expect((await transfer(owner, coach.userId)).statusCode).toBe(204);
    expect((await members()).staff).toEqual({ profe: 'coach', ana: 'assistant' });
    // Al que ya es entrenador, nada cambia.
    expect((await transfer(owner, coach.userId)).statusCode).toBe(204);
  });
});
