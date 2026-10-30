import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import {
  ClubCodeListResponseSchema,
  CreateClubCodeResponseSchema,
  CreateClubResponseSchema,
  CreateTeamResponseSchema,
  ErrorBodySchema,
  MeResponseSchema,
  POLICY_VERSION,
  TeamResponseSchema,
} from '@sdl/contracts';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createDb, type DbConnection } from '../../../shared/db/client.js';
import { bootApp, TEST_ENV } from '../../../test/app.js';
import { startMigratedPostgres } from '../../../test/postgres.js';
import { seedUserWithSession, type SeededUser } from '../../../test/sessions.js';
import { user } from '../../identity/infrastructure/schema.js';
import { club, clubSignupCode } from '../infrastructure/schema.js';

describe('códigos de alta de clubes (2026-10-29)', () => {
  let container: StartedPostgreSqlContainer;
  let connection: DbConnection;
  let app: NestFastifyApplication;
  let admin: SeededUser, someone: SeededUser;

  const call = (
    method: 'GET' | 'POST' | 'DELETE',
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

  beforeAll(async () => {
    container = await startMigratedPostgres();
    const url = container.getConnectionUri();
    connection = createDb(url);
    admin = await seedUserWithSession(url, { name: 'Kevin', email: 'kevin@example.com' });
    someone = await seedUserWithSession(url, { name: 'Pedro', email: 'pedro@example.com' });
    await connection.db.update(user).set({ platformAdmin: true }).where(eq(user.id, admin.userId));
    app = await bootApp(url);
  });

  afterAll(async () => {
    await app?.close();
    await connection?.pool.end();
    vi.unstubAllEnvs();
    await container?.stop();
  });

  it('el administrador de la plataforma lo ve en /me; los demás no', async () => {
    expect(
      MeResponseSchema.parse((await call('GET', '/me', admin)).json()).user.platformAdmin,
    ).toBe(true);
    expect(
      MeResponseSchema.parse((await call('GET', '/me', someone)).json()).user.platformAdmin,
    ).toBe(false);
  });

  it('crea un código: viaja una sola vez, con su enlace, y en la BD queda el hash', async () => {
    const res = await call('POST', '/admin/club-codes', admin, { note: 'Pedro, Los Tigres' });
    expect(res.statusCode).toBe(201);
    const created = CreateClubCodeResponseSchema.parse(res.json());
    expect(created.clubCode).toMatchObject({
      note: 'Pedro, Los Tigres',
      status: 'active',
      club: null,
    });
    expect(created.url).toBe(`${TEST_ENV.WEB_ORIGIN}/crear-club/${created.code}`);
    // Vence en 14 días por defecto.
    const days = (Date.parse(created.clubCode.expiresAt) - Date.now()) / 86_400_000;
    expect(Math.round(days)).toBe(14);

    const [row] = await connection.db
      .select()
      .from(clubSignupCode)
      .where(eq(clubSignupCode.id, created.clubCode.id));
    expect(JSON.stringify(row)).not.toContain(created.code);

    const list = ClubCodeListResponseSchema.parse(
      (await call('GET', '/admin/club-codes', admin)).json(),
    );
    expect(list.items[0]!.id).toBe(created.clubCode.id);
    expect(JSON.stringify(list)).not.toContain(created.code);
  });

  it('anular deja el código anulado; uno que no existe da 404', async () => {
    const { clubCode } = CreateClubCodeResponseSchema.parse(
      (await call('POST', '/admin/club-codes', admin, {})).json(),
    );
    expect((await call('DELETE', `/admin/club-codes/${clubCode.id}`, admin)).statusCode).toBe(204);
    const list = ClubCodeListResponseSchema.parse(
      (await call('GET', '/admin/club-codes', admin)).json(),
    );
    expect(list.items.find((c) => c.id === clubCode.id)?.status).toBe('revoked');
    const missing = await call(
      'DELETE',
      '/admin/club-codes/0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f00',
      admin,
    );
    expect(missing.statusCode).toBe(404);
  });

  it('nadie más los crea, los ve ni los anula; valida lo que llega', async () => {
    expect((await call('POST', '/admin/club-codes', someone, {})).statusCode).toBe(403);
    expect((await call('GET', '/admin/club-codes', someone)).statusCode).toBe(403);
    expect(
      (await call('DELETE', '/admin/club-codes/0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f00', someone))
        .statusCode,
    ).toBe(403);
    expect((await call('POST', '/admin/club-codes', admin, { expiresInDays: 0 })).statusCode).toBe(
      400,
    );
    expect((await app.inject({ method: 'GET', url: '/api/v1/admin/club-codes' })).statusCode).toBe(
      401,
    );
  });

  describe('crear mi club con el código', () => {
    const newCode = async () =>
      CreateClubCodeResponseSchema.parse(
        (await call('POST', '/admin/club-codes', admin, {})).json(),
      ).code;
    const form = (code: string, extra: object = {}) => ({
      code,
      clubName: 'Los Tigres del Sur',
      city: 'Bosa',
      teamName: 'Tigres',
      category: 'Veteranos',
      format: 'F8',
      season: '2026',
      alsoPlays: true,
      ...extra,
    });
    const code4 = (res: { json: () => unknown }) => ErrorBodySchema.parse(res.json()).error.code;

    it('sin sesión ve si el código sirve; con uno que no existe, 404', async () => {
      const code = await newCode();
      const ok = await app.inject({
        method: 'GET',
        url: `/api/v1/club-codes/${code.toLowerCase()}`,
      });
      expect(ok.statusCode).toBe(200);
      const missing = await app.inject({ method: 'GET', url: '/api/v1/club-codes/AAAAAAAAAA' });
      expect(missing.statusCode).toBe(404);
      expect(code4(missing)).toBe('CLUB_CODE_NOT_FOUND');
    });

    it('sin la política aceptada no lo crea', async () => {
      const res = await call('POST', '/clubs', someone, form(await newCode()));
      expect(res.statusCode).toBe(403);
      expect(code4(res)).toBe('CONSENT_REQUIRED');
    });

    it('crea el club y su equipo: dueño, entrenador y jugador; el código queda usado', async () => {
      await call('POST', '/me/consent', someone, {
        policyVersion: POLICY_VERSION,
        ageConfirmed: true,
      });
      const code = await newCode();
      const res = await call('POST', '/clubs', someone, form(code));
      expect(res.statusCode).toBe(201);
      const { clubId, teamId } = CreateClubResponseSchema.parse(res.json());

      const me = MeResponseSchema.parse((await call('GET', '/me', someone)).json());
      expect(me.clubs).toEqual([{ id: clubId, name: 'Los Tigres del Sur', role: 'owner' }]);
      expect(me.teams.find((t) => t.team.id === teamId)?.roles.sort()).toEqual(['coach', 'player']);
      const team = TeamResponseSchema.parse(
        (await call('GET', `/teams/${teamId}`, someone)).json(),
      );
      expect(team.team).toMatchObject({
        name: 'Tigres',
        format: 'F8',
        formats: ['F8'],
        season: '2026',
      });
      const [row] = await connection.db.select().from(club).where(eq(club.id, clubId));
      expect(row).toMatchObject({ slug: 'los-tigres-del-sur', city: 'Bosa' });

      const list = ClubCodeListResponseSchema.parse(
        (await call('GET', '/admin/club-codes', admin)).json(),
      );
      expect(list.items.find((c) => c.club?.id === clubId)?.status).toBe('used');
      const again = await call('POST', '/clubs', admin, form(code));
      expect(again.statusCode).toBe(422);
      expect(code4(again)).toBe('CLUB_CODE_USED');
    });

    it('dueño de un solo club: el segundo no gasta el código', async () => {
      const code = await newCode();
      const res = await call('POST', '/clubs', someone, form(code, { clubName: 'Otro' }));
      expect(res.statusCode).toBe(409);
      expect(code4(res)).toBe('CLUB_LIMIT_REACHED');
      expect(
        (await app.inject({ method: 'GET', url: `/api/v1/club-codes/${code}` })).statusCode,
      ).toBe(200);
    });

    it('el nombre repetido recibe otro slug; valida el formulario', async () => {
      await call('POST', '/me/consent', admin, {
        policyVersion: POLICY_VERSION,
        ageConfirmed: true,
      });
      const res = await call('POST', '/clubs', admin, form(await newCode(), { alsoPlays: false }));
      const { clubId } = CreateClubResponseSchema.parse(res.json());
      const [row] = await connection.db.select().from(club).where(eq(club.id, clubId));
      expect(row!.slug).toBe('los-tigres-del-sur-2');
      expect((await call('POST', '/clubs', admin, form('X', { format: 'F5' }))).statusCode).toBe(
        400,
      );
    });
  });

  describe('más equipos en el club', () => {
    const newTeam = (who: SeededUser, clubId: string, name: string, extra: object = {}) =>
      call('POST', `/clubs/${clubId}/teams`, who, {
        name,
        format: 'F11',
        season: '2026',
        ...extra,
      });

    it('el dueño crea hasta 3 equipos y queda de entrenador; nadie más', async () => {
      const me = MeResponseSchema.parse((await call('GET', '/me', someone)).json());
      const clubId = me.clubs[0]!.id;

      const second = await newTeam(someone, clubId, 'Tigres B', { category: 'Libre' });
      expect(second.statusCode).toBe(201);
      const { teamId } = CreateTeamResponseSchema.parse(second.json());
      const team = TeamResponseSchema.parse(
        (await call('GET', `/teams/${teamId}`, someone)).json(),
      );
      expect(team).toMatchObject({
        team: { name: 'Tigres B', category: 'Libre' },
        myRoles: ['coach'],
      });

      const taken = await newTeam(someone, clubId, 'Tigres B');
      expect(taken.statusCode).toBe(409);
      expect(ErrorBodySchema.parse(taken.json()).error.code).toBe('TEAM_NAME_TAKEN');

      expect((await newTeam(someone, clubId, 'Tigres C')).statusCode).toBe(201);
      const fourth = await newTeam(someone, clubId, 'Tigres D');
      expect(fourth.statusCode).toBe(409);
      expect(ErrorBodySchema.parse(fourth.json()).error.code).toBe('TEAM_LIMIT_REACHED');

      // El dueño de otro club no crea equipos en este.
      expect((await newTeam(admin, clubId, 'Intrusos')).statusCode).toBe(403);
      expect((await newTeam(someone, clubId, 'X', { format: 'F5' })).statusCode).toBe(400);
    });
  });
});
