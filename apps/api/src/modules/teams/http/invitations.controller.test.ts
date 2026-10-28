import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import {
  AcceptInvitationResponseSchema,
  CreateInvitationResponseSchema,
  ErrorBodySchema,
  InvitationListResponseSchema,
  InvitationPreviewResponseSchema,
  POLICY_VERSION,
} from '@sdl/contracts';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createDb, type DbConnection } from '../../../shared/db/client.js';
import { NOTIFIER, type Notifier } from '../../../shared/notifications/notifier.port.js';
import { bootApp, TEST_ENV } from '../../../test/app.js';
import { startMigratedPostgres } from '../../../test/postgres.js';
import { seedUserWithSession, type SeededUser } from '../../../test/sessions.js';
import { bootstrapTeam } from '../infrastructure/bootstrap-team.js';
import { invitation, teamMembership } from '../infrastructure/schema.js';

describe('invitaciones', () => {
  let container: StartedPostgreSqlContainer;
  let connection: DbConnection;
  let app: NestFastifyApplication;
  let url: string;
  let owner: SeededUser, coach: SeededUser, outsider: SeededUser;
  let teamId: string;
  let counter = 0;

  /** Jugador nuevo que ya aceptó la política vigente. */
  const newUser = async () => {
    counter++;
    const user = await seedUserWithSession(url, {
      name: `Jugador ${counter}`,
      email: `j${counter}@example.com`,
    });
    await request('POST', '/me/consent', user, {
      policyVersion: POLICY_VERSION,
      ageConfirmed: true,
    });
    return user;
  };

  const request = (
    method: 'GET' | 'POST' | 'PATCH' | 'DELETE',
    path: string,
    who?: SeededUser,
    payload?: object,
  ) =>
    app.inject({
      method,
      url: `/api/v1${path}`,
      headers: {
        origin: TEST_ENV.WEB_ORIGIN,
        ...(who ? { cookie: who.cookie } : {}),
        ...(payload ? { 'content-type': 'application/json' } : {}),
      },
      ...(payload ? { payload } : {}),
    });

  async function invite(who: SeededUser, payload: object = {}) {
    const res = await request('POST', `/teams/${teamId}/invitations`, who, payload);
    expect(res.statusCode).toBe(201);
    return CreateInvitationResponseSchema.parse(res.json());
  }

  beforeAll(async () => {
    container = await startMigratedPostgres();
    url = container.getConnectionUri();
    connection = createDb(url);
    owner = await seedUserWithSession(url, { name: 'Dueño', email: 'owner@example.com' });
    coach = await seedUserWithSession(url, { name: 'Profe', email: 'coach@example.com' });
    outsider = await seedUserWithSession(url, { name: 'Otro', email: 'otro@example.com' });
    ({ teamId } = await bootstrapTeam(connection.db, {
      clubName: 'Los del Barrio',
      clubSlug: 'los-del-barrio',
      teamName: 'Primer equipo',
      format: 'F8',
      season: '2026',
      ownerEmail: 'owner@example.com',
      coachEmail: 'coach@example.com',
    }));
    app = await bootApp(url);
  });

  afterAll(async () => {
    await app?.close();
    await connection?.pool.end();
    vi.unstubAllEnvs();
    await container?.stop();
  });

  it('el entrenador crea una invitación de jugador; el código solo viaja en la respuesta', async () => {
    const created = await invite(coach);
    expect(created.invitation).toMatchObject({
      role: 'player',
      status: 'active',
      maxUses: 30,
      usedCount: 0,
    });
    expect(created.joinUrl).toBe(`${TEST_ENV.WEB_ORIGIN}/unirse/${created.code}`);

    const [row] = await connection.db
      .select()
      .from(invitation)
      .where(eq(invitation.id, created.invitation.id));
    expect(row!.codeHash).not.toContain(created.code);
    expect(JSON.stringify(row)).not.toContain(created.code);
  });

  it('invitar cuerpo técnico es solo del admin del club', async () => {
    const res = await request('POST', `/teams/${teamId}/invitations`, coach, { role: 'assistant' });
    expect(res.statusCode).toBe(403);
    expect((await invite(owner, { role: 'assistant' })).invitation.role).toBe('assistant');
  });

  it('jugadores y gente de fuera no pueden invitar', async () => {
    const player = await newUser();
    const { code } = await invite(coach);
    await request('POST', `/invitations/${code}/accept`, player);
    expect((await request('POST', `/teams/${teamId}/invitations`, player, {})).statusCode).toBe(
      403,
    );
    expect((await request('POST', `/teams/${teamId}/invitations`, outsider, {})).statusCode).toBe(
      403,
    );
  });

  it('valida el cuerpo con el contrato', async () => {
    const res = await request('POST', `/teams/${teamId}/invitations`, coach, { maxUses: 0 });
    expect(res.statusCode).toBe(400);
    expect(ErrorBodySchema.parse(res.json()).error.code).toBe('VALIDATION_ERROR');
  });

  it('la lista no trae códigos y el entrenador no ve las de cuerpo técnico', async () => {
    const coachList = InvitationListResponseSchema.parse(
      (await request('GET', `/teams/${teamId}/invitations`, coach)).json(),
    );
    expect(coachList.items.every((i) => i.role === 'player')).toBe(true);
    expect(JSON.stringify(coachList)).not.toMatch(/code/i);

    const ownerList = InvitationListResponseSchema.parse(
      (await request('GET', `/teams/${teamId}/invitations`, owner)).json(),
    );
    expect(ownerList.items.some((i) => i.role === 'assistant')).toBe(true);
  });

  it('cualquiera ve a qué equipo invita el enlace, sin sesión y escrito como sea', async () => {
    const { code } = await invite(coach);
    const messy = `${code.slice(0, 5).toLowerCase()}-${code.slice(5)}`;
    const res = await request('GET', `/invitations/${messy}`);
    expect(res.statusCode).toBe(200);
    expect(InvitationPreviewResponseSchema.parse(res.json())).toEqual({
      team: { id: teamId, name: 'Primer equipo', format: 'F8' },
      club: { name: 'Los del Barrio' },
      role: 'player',
    });

    const unknown = await request('GET', '/invitations/AAAAAAAAAA');
    expect(unknown.statusCode).toBe(404);
    expect(ErrorBodySchema.parse(unknown.json()).error.code).toBe('INVITATION_NOT_FOUND');
  });

  it('aceptar suma al equipo; repetir no gasta otro uso', async () => {
    const player = await newUser();
    const { code, invitation: inv } = await invite(coach, { maxUses: 5 });

    const first = await request('POST', `/invitations/${code}/accept`, player);
    expect(first.statusCode).toBe(201);
    expect(AcceptInvitationResponseSchema.parse(first.json())).toEqual({
      teamId,
      role: 'player',
      alreadyMember: false,
    });
    expect((await request('GET', `/teams/${teamId}`, player)).json()).toMatchObject({
      myRoles: ['player'],
    });

    const again = await request('POST', `/invitations/${code}/accept`, player);
    expect(again.json()).toMatchObject({ alreadyMember: true });
    const [row] = await connection.db
      .select({ usedCount: invitation.usedCount })
      .from(invitation)
      .where(eq(invitation.id, inv.id));
    expect(row!.usedCount).toBe(1);
  });

  it('al que entra tarde le llega la convocatoria de los partidos abiertos, una vez', async () => {
    const convocar = async (opponent: string) => {
      const res = await request('POST', `/teams/${teamId}/matches`, coach, {
        kind: 'friendly',
        format: 'F8',
        startsAt: new Date(Date.now() + 2 * 86_400_000).toISOString(),
        place: 'La 14',
        opponent,
      });
      return (res.json() as { match: { id: string } }).match.id;
    };
    const open = await convocar('Los Pibes');
    const cancelled = await convocar('Veteranos');
    await request('PATCH', `/teams/${teamId}/matches/${cancelled}`, coach, {
      status: 'cancelled',
    });

    const notify = vi.spyOn(app.get<Notifier>(NOTIFIER, { strict: false }), 'notifyUsers');
    const late = await newUser();
    const { code } = await invite(coach, { maxUses: 5 });
    await request('POST', `/invitations/${code}/accept`, late);
    expect(notify).toHaveBeenCalledExactlyOnceWith([late.userId], {
      kind: 'match-called',
      opponent: 'Los Pibes',
      startsAt: expect.any(String),
      url: `/equipos/${teamId}/partidos/${open}`,
    });
    // Volver a abrir el enlace no repite el aviso.
    await request('POST', `/invitations/${code}/accept`, late);
    expect(notify).toHaveBeenCalledOnce();
    notify.mockRestore();
    await request('PATCH', `/teams/${teamId}/matches/${open}`, coach, { status: 'cancelled' });
  });

  it('aceptar exige sesión y haber aceptado la política de datos', async () => {
    const { code } = await invite(coach);
    expect((await request('POST', `/invitations/${code}/accept`)).statusCode).toBe(401);

    const withoutConsent = await seedUserWithSession(url, {
      name: 'Sin consentimiento',
      email: 'sin-consentimiento@example.com',
    });
    const res = await request('POST', `/invitations/${code}/accept`, withoutConsent);
    expect(res.statusCode).toBe(403);
    expect(ErrorBodySchema.parse(res.json()).error.code).toBe('CONSENT_REQUIRED');
    // Ver a qué equipo invita sí se puede antes de aceptar nada.
    expect((await request('GET', `/invitations/${code}`, withoutConsent)).statusCode).toBe(200);
  });

  it('una invitación individual no la usan dos personas, ni a la vez', async () => {
    const { code } = await invite(coach, { maxUses: 1 });
    const [a, b] = [await newUser(), await newUser()];
    const results = await Promise.all([
      request('POST', `/invitations/${code}/accept`, a),
      request('POST', `/invitations/${code}/accept`, b),
    ]);
    expect(results.map((r) => r.statusCode).sort()).toEqual([201, 422]);
    const loser = results.find((r) => r.statusCode === 422)!;
    expect(ErrorBodySchema.parse(loser.json()).error.code).toBe('INVITATION_USED_UP');
  });

  it('revocada o vencida deja de valer, con su código de error', async () => {
    const revoked = await invite(coach);
    const del = await request(
      'DELETE',
      `/teams/${teamId}/invitations/${revoked.invitation.id}`,
      coach,
    );
    expect(del.statusCode).toBe(204);
    // Revocar dos veces no falla.
    expect(
      (await request('DELETE', `/teams/${teamId}/invitations/${revoked.invitation.id}`, coach))
        .statusCode,
    ).toBe(204);
    expect((await request('GET', `/invitations/${revoked.code}`)).json()).toMatchObject({
      error: { code: 'INVITATION_REVOKED' },
    });

    const expired = await invite(coach);
    await connection.db
      .update(invitation)
      .set({ expiresAt: new Date(Date.now() - 1000) })
      .where(eq(invitation.id, expired.invitation.id));
    const res = await request('POST', `/invitations/${expired.code}/accept`, await newUser());
    expect(res.statusCode).toBe(422);
    expect(res.json()).toMatchObject({ error: { code: 'INVITATION_EXPIRED' } });
  });

  it('no se puede revocar una invitación de otro equipo usando el propio', async () => {
    const otherTeam = await bootstrapTeam(connection.db, {
      clubName: 'Los del Barrio',
      clubSlug: 'los-del-barrio',
      teamName: 'Veteranos',
      format: 'F11',
      season: '2026',
      ownerEmail: 'owner@example.com',
      coachEmail: 'otro@example.com',
    });
    const res = await request('POST', `/teams/${otherTeam.teamId}/invitations`, outsider, {});
    const foreign = CreateInvitationResponseSchema.parse(res.json());
    const del = await request(
      'DELETE',
      `/teams/${teamId}/invitations/${foreign.invitation.id}`,
      coach,
    );
    expect(del.statusCode).toBe(404);
  });

  it('quien salió del equipo vuelve a entrar con una invitación nueva', async () => {
    const player = await newUser();
    await request('POST', `/invitations/${(await invite(coach)).code}/accept`, player);
    await connection.db
      .update(teamMembership)
      .set({ leftAt: new Date() })
      .where(eq(teamMembership.userId, player.userId));
    expect((await request('GET', `/teams/${teamId}`, player)).statusCode).toBe(403);

    const back = await request('POST', `/invitations/${(await invite(coach)).code}/accept`, player);
    expect(back.json()).toMatchObject({ alreadyMember: false });
    expect((await request('GET', `/teams/${teamId}`, player)).statusCode).toBe(200);
  });
});
