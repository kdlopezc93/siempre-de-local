import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import {
  ClubResponseSchema,
  CreateClubCodeResponseSchema,
  CreateClubResponseSchema,
  CreateInvitationResponseSchema,
  CreateTeamResponseSchema,
  MyDataExportSchema,
  TeamScorersResponseSchema,
  ErrorBodySchema,
  GUARDIAN_AUTHORIZATION_VERSION,
  InvitationPreviewResponseSchema,
  MeResponseSchema,
  POLICY_VERSION,
  MatchListResponseSchema,
  MatchResponseSchema,
  MyChargesResponseSchema,
  RegisterMinorResponseSchema,
} from '@sdl/contracts';
import { and, eq, isNull } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createDb, type DbConnection } from '../../../shared/db/client.js';
import { bootApp, TEST_ENV } from '../../../test/app.js';
import { startMigratedPostgres } from '../../../test/postgres.js';
import { seedUserWithSession, type SeededUser } from '../../../test/sessions.js';
import { account, user } from '../../identity/infrastructure/schema.js';
import { auditLog } from '../../audit/infrastructure/schema.js';
import { payment } from '../../charges/infrastructure/schema.js';
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
      gender: 'male',
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

  describe('el acudiente actúa por su hijo (PR 3, 2026-11-10)', () => {
    let minorId: string;
    const child = (who: SeededUser, method: 'GET' | 'PUT' | 'POST', path: string, body?: object) =>
      call(method, `/me/children/${minorId}/teams/${groupId}${path}`, who, body);

    beforeAll(async () => {
      const [link] = await connection.db
        .select({ minorUserId: guardianship.minorUserId })
        .from(guardianship)
        .where(eq(guardianship.guardianUserId, mama.userId));
      minorId = link!.minorUserId;
    });

    it('ve los partidos de su hijo y responde la convocatoria por él', async () => {
      const startsAt = new Date(Date.now() + 3 * 86_400_000).toISOString();
      const { match } = MatchResponseSchema.parse(
        (
          await call('POST', `/teams/${groupId}/matches`, director, {
            kind: 'training',
            format: 'F8',
            startsAt,
            place: 'Sede Kennedy',
          })
        ).json(),
      );
      const list = MatchListResponseSchema.parse((await child(mama, 'GET', '/matches')).json());
      expect(list.items.map((m) => [m.id, m.myReply])).toEqual([[match.id, null]]);

      const replied = await child(mama, 'PUT', `/matches/${match.id}/reply`, { reply: 'yes' });
      expect(replied.statusCode).toBe(200);
      const view = MatchResponseSchema.parse(replied.json());
      expect(view.match.myReply).toBe('yes');
      // Como jugador: sin la lista de quién respondió qué.
      expect(view.roster).toBeNull();

      // El profe ve la respuesta del niño.
      const staff = MatchResponseSchema.parse(
        (await call('GET', `/teams/${groupId}/matches/${match.id}`, director)).json(),
      );
      expect(staff.roster?.find((p) => p.playerId === minorId)?.reply).toBe('yes');
    });

    it('ve sus cobros y reporta el pago; el reporte queda a nombre del acudiente', async () => {
      const created = await call('POST', `/teams/${groupId}/charges`, director, {
        kind: 'other',
        title: 'Mensualidad de noviembre',
        split: 'per_person',
        amount: 120_000,
        playerIds: [minorId],
      });
      expect(created.statusCode).toBe(201);
      const mine = MyChargesResponseSchema.parse((await child(mama, 'GET', '/charges')).json());
      expect(mine.owed).toBe(120_000);
      const chargeId = mine.items[0]!.charge.id;

      const today = new Date().toISOString().slice(0, 10);
      const reported = await child(mama, 'POST', `/charges/${chargeId}/payments`, {
        amount: 120_000,
        method: 'nequi',
        paidOn: today,
        // Un niño no patrocina a nadie: se ignora.
        forUserId: papa.userId,
      });
      expect(reported.statusCode).toBe(201);
      expect(MyChargesResponseSchema.parse(reported.json()).items[0]).toMatchObject({
        status: 'pending',
        reported: 120_000,
      });
      const [row] = await connection.db
        .select({ userId: payment.userId, reportedBy: payment.reportedBy })
        .from(payment)
        .where(eq(payment.chargeId, chargeId));
      expect(row).toEqual({ userId: minorId, reportedBy: mama.userId });
      const audit = await connection.db
        .select({ actor: auditLog.actorUserId })
        .from(auditLog)
        .where(and(eq(auditLog.entityId, chargeId), eq(auditLog.action, 'payment.reported')));
      expect(audit).toEqual([{ actor: mama.userId }]);
    });

    it('un niño ajeno no existe para quien no es su acudiente', async () => {
      for (const who of [papa, director]) {
        const res = await child(who, 'GET', '/matches');
        expect(res.statusCode).toBe(404);
        expect(errorCode(res)).toBe('CHILD_NOT_FOUND');
      }
      // Y el acudiente no entra al equipo por las rutas de siempre.
      expect((await call('GET', `/teams/${groupId}/matches`, mama)).statusCode).toBe(403);
    });
  });

  describe('reglas de menores y derechos del acudiente (PR 4, 2026-11-10)', () => {
    let minorId: string;
    let groupB: string;
    let sub10: string;

    const newGroup = async (body: object) =>
      CreateTeamResponseSchema.parse(
        (
          await call('POST', `/clubs/${schoolId}/teams`, director, {
            format: 'F8',
            season: '2026',
            ...body,
          })
        ).json(),
      ).teamId;

    beforeAll(async () => {
      const [link] = await connection.db
        .select({ minorUserId: guardianship.minorUserId })
        .from(guardianship)
        .where(eq(guardianship.guardianUserId, mama.userId));
      minorId = link!.minorUserId;
      groupB = await newGroup({
        name: 'Sub-12 masculino B',
        category: 'Sub-12',
        birthYears: { from: 2014, to: 2015 },
        gender: 'male',
      });
      sub10 = await newGroup({
        name: 'Sub-10',
        category: 'Sub-10',
        birthYears: { from: 2016, to: 2017 },
        gender: 'mixed',
      });
    });

    it('en un grupo de menores no hay tabla de goleadores', async () => {
      const res = await call('GET', `/teams/${groupId}/scorers`, director);
      expect(TeamScorersResponseSchema.parse(res.json())).toEqual({ players: [], forMinors: true });
    });

    it('el profe pasa al niño de un grupo a otro de sus años, y no a uno de otros años', async () => {
      const wrong = await call('POST', `/teams/${groupId}/members/${minorId}/move`, director, {
        toTeamId: sub10,
      });
      expect(errorCode(wrong)).toBe('CHILD_NOT_IN_CATEGORY');

      const moved = await call('POST', `/teams/${groupId}/members/${minorId}/move`, director, {
        toTeamId: groupB,
      });
      expect(moved.statusCode).toBe(204);
      const active = await connection.db
        .select({ teamId: teamMembership.teamId })
        .from(teamMembership)
        .where(and(eq(teamMembership.userId, minorId), isNull(teamMembership.leftAt)));
      expect(active).toEqual([{ teamId: groupB }]);
      // El acudiente lo ve en su grupo nuevo.
      const me = MeResponseSchema.parse((await call('GET', '/me', mama)).json());
      expect(me.children[0]!.teams.map((t) => t.team.id)).toEqual([groupB]);

      const again = await call('POST', `/teams/${groupB}/members/${minorId}/move`, director, {
        toTeamId: groupB,
      });
      expect(errorCode(again)).toBe('SAME_GROUP');
      // Quien no maneja el grupo, no.
      const stranger = await call('POST', `/teams/${groupB}/members/${minorId}/move`, papa, {
        toTeamId: groupId,
      });
      expect(stranger.statusCode).toBe(403);
    });

    it('el acudiente descarga los datos de su hijo; nadie más', async () => {
      const res = await call('GET', `/me/children/${minorId}/export`, mama);
      expect(res.statusCode).toBe(200);
      const data = MyDataExportSchema.parse(res.json());
      expect(data.account).toMatchObject({ name: 'Juan Pérez', email: '' });
      // Su grupo actual va en sus datos.
      expect(JSON.stringify(data.memberships)).toContain(groupB);
      const other = await call('GET', `/me/children/${minorId}/export`, papa);
      expect(other.statusCode).toBe(404);
      expect(errorCode(other)).toBe('CHILD_NOT_FOUND');
    });

    it('si el acudiente borra su cuenta, se borra el niño que solo él manejaba', async () => {
      const deleted = await call('DELETE', '/me', mama, { confirmation: 'ELIMINAR' });
      expect(deleted.statusCode).toBe(204);
      expect(await connection.db.select().from(user).where(eq(user.id, minorId))).toEqual([]);
    });

    it('el acudiente borra los datos de su hijo con la confirmación', async () => {
      // Un niño nuevo, de otra mamá.
      const otra = await seedUserWithSession(container.getConnectionUri(), {
        name: 'Rosa',
        email: 'rosa@example.com',
      });
      await consent(otra);
      const { minorId: hijo } = RegisterMinorResponseSchema.parse(
        (await register(otra, { child: { name: 'Tomás', birthYear: 2015 } })).json(),
      );
      const sin = await call('DELETE', `/me/children/${hijo}`, otra, {});
      expect(sin.statusCode).toBe(400);
      expect(
        (await call('DELETE', `/me/children/${hijo}`, papa, { confirmation: 'ELIMINAR' }))
          .statusCode,
      ).toBe(404);
      const ok = await call('DELETE', `/me/children/${hijo}`, otra, { confirmation: 'ELIMINAR' });
      expect(ok.statusCode).toBe(204);
      expect(await connection.db.select().from(user).where(eq(user.id, hijo))).toEqual([]);
      // Su acudiente sigue.
      expect(
        await connection.db.select({ id: user.id }).from(user).where(eq(user.id, otra.userId)),
      ).toEqual([{ id: otra.userId }]);
    });
  });
});
