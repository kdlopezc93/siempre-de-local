import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import {
  ClubResponseSchema,
  CreateClubCodeResponseSchema,
  CreateClubResponseSchema,
  CreateInvitationResponseSchema,
  ErrorBodySchema,
  GUARDIAN_AUTHORIZATION_VERSION,
  InvitationPreviewResponseSchema,
  MeResponseSchema,
  POLICY_VERSION,
  RegisterMinorResponseSchema,
} from '@sdl/contracts';
import { and, eq, isNull } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createDb, type DbConnection } from '../../../shared/db/client.js';
import { bootApp, TEST_ENV } from '../../../test/app.js';
import { startMigratedPostgres } from '../../../test/postgres.js';
import { seedUserWithSession, type SeededUser } from '../../../test/sessions.js';
import { account, user } from '../../identity/infrastructure/schema.js';
import { teamMembership } from '../../teams/infrastructure/schema.js';
import { guardianship } from '../infrastructure/schema.js';

/** Menores y acudientes (escuelas, 2026-11-08, `08` §10). */
describe('acudientes inscriben a sus hijos (2026-11-08)', () => {
  let container: StartedPostgreSqlContainer;
  let connection: DbConnection;
  let app: NestFastifyApplication;
  let admin: SeededUser, director: SeededUser, mama: SeededUser, papa: SeededUser;
  let schoolId: string, groupId: string, guardianCode: string, playerCode: string;

  const call = (
    method: 'GET' | 'POST' | 'PATCH' | 'PUT' | 'DELETE',
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
  const errorCode = (res: { json: () => unknown }) => ErrorBodySchema.parse(res.json()).error.code;
  const consent = (who: SeededUser) =>
    call('POST', '/me/consent', who, { policyVersion: POLICY_VERSION, ageConfirmed: true });
  const thisYear = new Date().getFullYear();
  const register = (who: SeededUser, extra: object = {}, code = guardianCode) =>
    call('POST', `/invitations/${code}/minors`, who, {
      child: { name: 'Juan Pérez', birthYear: 2014 },
      relationship: 'mother',
      authorizationVersion: GUARDIAN_AUTHORIZATION_VERSION,
      ...extra,
    });

  beforeAll(async () => {
    container = await startMigratedPostgres();
    const url = container.getConnectionUri();
    connection = createDb(url);
    admin = await seedUserWithSession(url, { name: 'Kevin', email: 'kevin@example.com' });
    director = await seedUserWithSession(url, { name: 'Marta', email: 'marta@example.com' });
    mama = await seedUserWithSession(url, { name: 'Luisa', email: 'luisa@example.com' });
    papa = await seedUserWithSession(url, { name: 'Carlos', email: 'carlos@example.com' });
    await connection.db.update(user).set({ platformAdmin: true }).where(eq(user.id, admin.userId));
    app = await bootApp(url);
    await consent(director);
    const { code } = CreateClubCodeResponseSchema.parse(
      (await call('POST', '/admin/club-codes', admin, { kind: 'school' })).json(),
    );
    ({ clubId: schoolId, teamId: groupId } = CreateClubResponseSchema.parse(
      (
        await call('POST', '/clubs', director, {
          code,
          clubName: 'Escuela Semillas',
          city: 'Kennedy',
          teamName: 'Sub-12 masculino',
          category: 'Sub-12',
          format: 'F8',
          season: '2026',
          birthYears: { from: 2014, to: 2015 },
          gender: 'male',
        })
      ).json(),
    ));
    guardianCode = CreateInvitationResponseSchema.parse(
      (
        await call('POST', `/teams/${groupId}/invitations`, director, {
          role: 'player',
          forGuardians: true,
        })
      ).json(),
    ).code;
    playerCode = CreateInvitationResponseSchema.parse(
      (await call('POST', `/teams/${groupId}/invitations`, director, { role: 'player' })).json(),
    ).code;
  });

  afterAll(async () => {
    await app?.close();
    await connection?.pool.end();
    vi.unstubAllEnvs();
    await container?.stop();
  });

  it('la vista previa dice que es para acudientes y los años del grupo', async () => {
    const res = await app.inject({ method: 'GET', url: `/api/v1/invitations/${guardianCode}` });
    expect(InvitationPreviewResponseSchema.parse(res.json())).toMatchObject({
      forGuardians: true,
      birthYears: { from: 2014, to: 2015 },
    });
  });

  it('sin la política aceptada, o sin la autorización vigente, no lo inscribe', async () => {
    expect(errorCode(await register(mama))).toBe('CONSENT_REQUIRED');
    await consent(mama);
    const old = await register(mama, { authorizationVersion: '2020-01-01' });
    expect(old.statusCode).toBe(422);
    expect(errorCode(old)).toBe('GUARDIAN_AUTHORIZATION_REQUIRED');
  });

  it('un mayor de edad, o un niño de otra categoría, no entra por aquí', async () => {
    const adult = await register(mama, { child: { name: 'Pedro', birthYear: thisYear - 18 } });
    expect(errorCode(adult)).toBe('MINOR_IS_ADULT');
    const other = await register(mama, { child: { name: 'Ana', birthYear: 2017 } });
    expect(errorCode(other)).toBe('CHILD_NOT_IN_CATEGORY');
    expect(ErrorBodySchema.parse(other.json()).error.message).toContain('2014–2015');
    expect(
      errorCode(await register(mama, { child: { name: 'Ana', birthYear: thisYear + 1 } })),
    ).toBe('INVALID_BIRTH_YEAR');
  });

  it('inscribe al niño: sin cuenta, a su cargo y de jugador del grupo', async () => {
    const res = await register(mama);
    expect(res.statusCode).toBe(201);
    const { minorId, teamId, alreadyMember } = RegisterMinorResponseSchema.parse(res.json());
    expect(teamId).toBe(groupId);
    expect(alreadyMember).toBe(false);

    const [child] = await connection.db.select().from(user).where(eq(user.id, minorId));
    expect(child).toMatchObject({ name: 'Juan Pérez', managed: true, birthYear: 2014 });
    expect(child!.email).toMatch(/@menor\.invalid$/);
    // Sin método de entrada.
    expect(await connection.db.select().from(account).where(eq(account.userId, minorId))).toEqual(
      [],
    );
    expect(
      await connection.db
        .select({ relationship: guardianship.relationship, v: guardianship.authorizationVersion })
        .from(guardianship)
        .where(eq(guardianship.minorUserId, minorId)),
    ).toEqual([{ relationship: 'mother', v: GUARDIAN_AUTHORIZATION_VERSION }]);
    const roles = await connection.db
      .select({ role: teamMembership.role })
      .from(teamMembership)
      .where(and(eq(teamMembership.userId, minorId), isNull(teamMembership.leftAt)));
    expect(roles).toEqual([{ role: 'player' }]);

    // La mamá lo ve en /me; ella no queda en el grupo.
    const me = MeResponseSchema.parse((await call('GET', '/me', mama)).json());
    expect(me.children).toEqual([
      {
        id: minorId,
        name: 'Juan Pérez',
        birthYear: 2014,
        relationship: 'mother',
        teams: [
          {
            team: { id: groupId, name: 'Sub-12 masculino' },
            club: { id: schoolId, name: 'Escuela Semillas', kind: 'school' },
          },
        ],
      },
    ]);
    expect(me.teams).toEqual([]);

    // Inscribirlo otra vez no lo duplica.
    const again = RegisterMinorResponseSchema.parse(
      (await register(mama, { child: { name: 'juan perez', birthYear: 2014 } })).json(),
    );
    expect(again).toEqual({ teamId: groupId, minorId, alreadyMember: true });
  });

  it('cada enlace a lo suyo: el de acudientes no sirve para entrar, ni el normal para inscribir', async () => {
    await consent(papa);
    const join = await call('POST', `/invitations/${guardianCode}/accept`, papa);
    expect(join.statusCode).toBe(422);
    expect(errorCode(join)).toBe('GUARDIAN_INVITATION');
    expect(errorCode(await register(papa, {}, playerCode))).toBe('NOT_A_GUARDIAN_INVITATION');
  });

  it('un menor solo juega: no es asistente, tesorero, entrenador ni admin', async () => {
    const [link] = await connection.db
      .select({ minorUserId: guardianship.minorUserId })
      .from(guardianship)
      .where(eq(guardianship.guardianUserId, mama.userId));
    const minorUserId = link!.minorUserId;
    const assistant = await call(
      'PATCH',
      `/teams/${groupId}/members/${minorUserId}/roles`,
      director,
      { assistant: true },
    );
    expect(errorCode(assistant)).toBe('MINOR_ONLY_PLAYS');
    const coach = await call('PUT', `/teams/${groupId}/coach`, director, {
      userId: minorUserId,
    });
    expect(errorCode(coach)).toBe('MINOR_ONLY_PLAYS');
    const school = ClubResponseSchema.parse(
      (await call('GET', `/clubs/${schoolId}`, director)).json(),
    );
    expect(school.candidates.map((c) => c.userId)).not.toContain(minorUserId);
  });

  it('las invitaciones para acudientes son de grupos de escuela', async () => {
    await consent(papa);
    const { code } = CreateClubCodeResponseSchema.parse(
      (await call('POST', '/admin/club-codes', admin, {})).json(),
    );
    const { teamId } = CreateClubResponseSchema.parse(
      (
        await call('POST', '/clubs', papa, {
          code,
          clubName: 'Los Tigres',
          city: 'Bosa',
          teamName: 'Tigres',
          format: 'F8',
          season: '2026',
        })
      ).json(),
    );
    const res = await call('POST', `/teams/${teamId}/invitations`, papa, {
      role: 'player',
      forGuardians: true,
    });
    expect(errorCode(res)).toBe('SCHOOL_ONLY');
  });
});
