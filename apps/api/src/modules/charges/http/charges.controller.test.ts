import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import {
  ChargeListResponseSchema,
  ChargeResponseSchema,
  MatchResponseSchema,
  MyChargesResponseSchema,
  TournamentResponseSchema,
} from '@sdl/contracts';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createDb, type DbConnection } from '../../../shared/db/client.js';
import { bootApp, TEST_ENV } from '../../../test/app.js';
import { startMigratedPostgres } from '../../../test/postgres.js';
import { seedUserWithSession, type SeededUser } from '../../../test/sessions.js';
import { bootstrapTeam } from '../../teams/infrastructure/bootstrap-team.js';
import { teamMembership } from '../../teams/infrastructure/schema.js';
import { NOTIFIER, type Notifier } from '../../../shared/notifications/notifier.port.js';

const inDays = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();

describe('cobros del equipo (06 Cobros)', () => {
  let container: StartedPostgreSqlContainer;
  let connection: DbConnection;
  let app: NestFastifyApplication;
  let coach: SeededUser, ana: SeededUser, beto: SeededUser, ciro: SeededUser, tesorera: SeededUser;
  let outsider: SeededUser;
  let teamId: string;

  beforeAll(async () => {
    container = await startMigratedPostgres();
    const url = container.getConnectionUri();
    connection = createDb(url);
    const seed = (name: string) => seedUserWithSession(url, { name, email: `${name}@example.com` });
    coach = await seed('coach');
    ana = await seed('ana');
    beto = await seed('beto');
    ciro = await seed('ciro');
    tesorera = await seed('tesorera');
    outsider = await seed('outsider');
    ({ teamId } = await bootstrapTeam(connection.db, {
      clubName: 'Los del Barrio',
      clubSlug: 'los-del-barrio',
      format: 'F8',
      teamName: 'Primer equipo',
      season: '2026',
      ownerEmail: 'coach@example.com',
      coachEmail: 'coach@example.com',
    }));
    await connection.db.insert(teamMembership).values([
      { teamId, userId: ana.userId, role: 'player', jerseyNumber: 4 },
      { teamId, userId: beto.userId, role: 'player', jerseyNumber: 9 },
      { teamId, userId: ciro.userId, role: 'player' },
      // La tesorera también juega (2026-10-30).
      { teamId, userId: tesorera.userId, role: 'player', jerseyNumber: 7 },
      { teamId, userId: tesorera.userId, role: 'treasurer' },
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
      url: `/api/v1/teams/${teamId}${path}`,
      headers: { cookie: who.cookie, origin: TEST_ENV.WEB_ORIGIN },
      ...(body ? { payload: body } : {}),
    });
  const today = new Date().toISOString().slice(0, 10);

  it('la vaca del amistoso: un total repartido a los $100 siguientes; abonos, "Ya pagué" y confirmar', async () => {
    const { match } = MatchResponseSchema.parse(
      (
        await call('POST', '/matches', coach, {
          kind: 'friendly',
          format: 'F8',
          startsAt: inDays(2),
          place: 'La 14',
          opponent: 'Los Pibes',
        })
      ).json(),
    );
    const vaca = {
      kind: 'vaca',
      matchId: match.id,
      split: 'total',
      amount: 70_000,
      playerIds: [ana.userId, beto.userId, ciro.userId],
    };
    // Un jugador no cobra; la tesorera sí.
    expect((await call('POST', '/charges', ana, vaca)).statusCode).toBe(403);
    const notify = vi.spyOn(app.get<Notifier>(NOTIFIER, { strict: false }), 'notifyUsers');
    const created = await call('POST', '/charges', tesorera, vaca);
    expect(created.statusCode).toBe(201);
    // A cada uno le llega el aviso, sin el valor.
    expect(notify).toHaveBeenCalledWith([ana.userId, beto.userId, ciro.userId], {
      kind: 'charge-created',
      charge: 'Vaca',
      opponent: 'Vaca',
      url: `/equipos/${teamId}/mis-cuentas`,
    });
    notify.mockRestore();
    const { charge, shares } = ChargeResponseSchema.parse(created.json());
    expect(charge).toMatchObject({
      kind: 'vaca',
      match: { id: match.id, opponent: 'Los Pibes' },
      people: 3,
      balance: { billed: 70_200, collected: 0, pending: 70_200 },
    });
    // 70.000 / 3 = 23.333,3 → 23.400 cada uno.
    expect(shares.map((s) => [s.displayName, s.amount, s.status])).toEqual([
      ['ana', 23_400, 'pending'],
      ['beto', 23_400, 'pending'],
      ['ciro', 23_400, 'pending'],
    ]);

    // La tesorera registra un abono de Ana: confirmado de una vez.
    const abono = await call('POST', `/charges/${charge.id}/payments`, tesorera, {
      userId: ana.userId,
      amount: 10_000,
      method: 'cash',
      paidOn: today,
    });
    expect(abono.statusCode).toBe(201);
    expect(
      ChargeResponseSchema.parse(abono.json()).shares.find((s) => s.userId === ana.userId),
    ).toMatchObject({ paid: 10_000, status: 'partial' });

    // Beto dice "Ya pagué" por Nequi: queda reportado y solo ve lo suyo.
    const report = await call('POST', `/me/charges/${charge.id}/payments`, beto, {
      amount: 23_400,
      method: 'nequi',
      paidOn: today,
    });
    expect(report.statusCode).toBe(201);
    const mine = MyChargesResponseSchema.parse(report.json());
    expect(mine.items).toHaveLength(1);
    expect(mine.items[0]).toMatchObject({ amount: 23_400, paid: 0, reported: 23_400 });
    expect(mine.owed).toBe(23_400);
    // No puede reportar dos veces lo mismo, ni pagar por otro.
    expect(
      (
        await call('POST', `/me/charges/${charge.id}/payments`, beto, {
          amount: 100,
          method: 'nequi',
          paidOn: today,
        })
      ).json(),
    ).toMatchObject({ error: { code: 'PAYMENT_TOO_HIGH' } });
    expect(
      (
        await call('POST', `/charges/${charge.id}/payments`, beto, {
          userId: ana.userId,
          amount: 100,
          method: 'cash',
          paidOn: today,
        })
      ).statusCode,
    ).toBe(403);

    // La tesorera lo confirma (una sola vez).
    const detail = ChargeResponseSchema.parse(
      (await call('GET', `/charges/${charge.id}`, tesorera)).json(),
    );
    expect(detail.charge.reported).toBe(1);
    const reported = detail.payments.find((p) => p.status === 'reported')!;
    expect(reported).toMatchObject({ userId: beto.userId, reportedBy: { name: 'beto' } });
    const confirmed = await call(
      'POST',
      `/charges/${charge.id}/payments/${reported.id}/confirm`,
      tesorera,
    );
    expect(confirmed.statusCode).toBe(200);
    const after = ChargeResponseSchema.parse(confirmed.json());
    expect(after.shares.find((s) => s.userId === beto.userId)?.status).toBe('paid');
    expect(after.charge.balance).toEqual({ billed: 70_200, collected: 33_400, pending: 36_800 });
    expect(
      (await call('POST', `/charges/${charge.id}/payments/${reported.id}/reject`, tesorera)).json(),
    ).toMatchObject({ error: { code: 'PAYMENT_REVIEWED' } });
    expect(
      MyChargesResponseSchema.parse((await call('GET', '/me/charges', beto)).json()).owed,
    ).toBe(0);
  });

  it('ajuste por persona, sumar a alguien, multa de uno solo y anular', async () => {
    const { tournament } = TournamentResponseSchema.parse(
      (await call('POST', '/tournaments', coach, { name: 'Copa del barrio' })).json(),
    );
    const inscripcion = ChargeResponseSchema.parse(
      (
        await call('POST', '/charges', coach, {
          kind: 'registration',
          tournamentId: tournament.id,
          split: 'per_person',
          amount: 40_000,
          dueOn: today,
          playerIds: [ana.userId, beto.userId],
        })
      ).json(),
    ).charge;
    expect(inscripcion).toMatchObject({ tournament: { name: 'Copa del barrio' }, amount: 40_000 });

    // A Ana el equipo le pone la mitad; Ciro se suma después.
    const half = await call('PUT', `/charges/${inscripcion.id}/shares/${ana.userId}`, tesorera, {
      amount: 20_000,
      note: 'Media beca',
    });
    expect(
      ChargeResponseSchema.parse(half.json()).shares.find((s) => s.userId === ana.userId),
    ).toMatchObject({ amount: 20_000, note: 'Media beca' });
    await call('PUT', `/charges/${inscripcion.id}/shares/${ciro.userId}`, tesorera, {
      amount: 40_000,
    });
    // No se le baja a menos de lo que ya pagó.
    await call('POST', `/charges/${inscripcion.id}/payments`, tesorera, {
      userId: beto.userId,
      amount: 30_000,
      method: 'transfer',
      paidOn: today,
    });
    expect(
      (
        await call('PUT', `/charges/${inscripcion.id}/shares/${beto.userId}`, tesorera, {
          amount: 10_000,
        })
      ).json(),
    ).toMatchObject({ error: { code: 'SHARE_BELOW_PAID' } });

    // Validaciones al crear.
    const base = { kind: 'fine', split: 'per_person', amount: 15_000 };
    expect(
      (
        await call('POST', '/charges', coach, { ...base, playerIds: [ana.userId, beto.userId] })
      ).json(),
    ).toMatchObject({
      error: { code: 'CHARGE_FIELDS', message: 'Una multa es de una sola persona.' },
    });
    expect(
      (await call('POST', '/charges', coach, { ...base, playerIds: [outsider.userId] })).json(),
    ).toMatchObject({ error: { code: 'PLAYER_NOT_IN_TEAM' } });
    const multa = await call('POST', '/charges', coach, {
      ...base,
      title: 'Amarilla contra Los Pibes',
      playerIds: [ciro.userId],
    });
    expect(multa.statusCode).toBe(201);

    // Anular: sale del saldo y de lo que debe cada uno; ya no se le pagan cosas.
    const cancelled = await call('PATCH', `/charges/${inscripcion.id}`, tesorera, {
      cancelled: true,
    });
    expect(ChargeResponseSchema.parse(cancelled.json()).charge.cancelled).toBe(true);
    expect(
      (
        await call('POST', `/charges/${inscripcion.id}/payments`, tesorera, {
          userId: ana.userId,
          amount: 1_000,
          method: 'cash',
          paidOn: today,
        })
      ).json(),
    ).toMatchObject({ error: { code: 'CHARGE_CANCELLED' } });
    const ciroOwes = MyChargesResponseSchema.parse((await call('GET', '/me/charges', ciro)).json());
    expect(ciroOwes.items.map((i) => i.charge.kind).sort()).toEqual(['fine', 'vaca']);
    expect(ciroOwes.owed).toBe(23_400 + 15_000);

    // La lista del equipo: el más nuevo primero, con el saldo sin los anulados. Un jugador no la ve.
    const list = ChargeListResponseSchema.parse((await call('GET', '/charges', tesorera)).json());
    expect(list.items.map((c) => c.kind)).toEqual(['fine', 'registration', 'vaca']);
    expect(list.balance).toEqual({
      billed: 70_200 + 15_000,
      collected: 33_400,
      pending: 36_800 + 15_000,
    });
    expect((await call('GET', '/charges', ana)).statusCode).toBe(403);
    expect((await call('GET', '/me/charges', outsider)).statusCode).toBe(403);
  });

  it('patrocinios: la parte de uno la asume otro jugador (que la paga) o el equipo', async () => {
    const arbitraje = ChargeResponseSchema.parse(
      (
        await call('POST', '/charges', tesorera, {
          kind: 'referee',
          split: 'per_person',
          amount: 8_000,
          playerIds: [ana.userId, beto.userId, ciro.userId],
        })
      ).json(),
    ).charge;
    const path = (userId: string) => `/charges/${arbitraje.id}/shares/${userId}/sponsor`;

    // Un jugador no patrocina a nadie desde aquí; nadie se patrocina a sí mismo ni de fuera.
    expect((await call('PUT', path(ciro.userId), beto, { sponsor: beto.userId })).statusCode).toBe(
      403,
    );
    expect(
      (await call('PUT', path(ciro.userId), tesorera, { sponsor: ciro.userId })).json(),
    ).toMatchObject({ error: { code: 'SPONSOR_NOT_ALLOWED' } });
    expect(
      (await call('PUT', path(ciro.userId), tesorera, { sponsor: outsider.userId })).json(),
    ).toMatchObject({ error: { code: 'PLAYER_NOT_IN_TEAM' } });

    // Beto asume la de Ciro; el equipo, la de Ana. A Ciro y a Beto les llega el aviso, sin valor.
    const notify = vi.spyOn(app.get<Notifier>(NOTIFIER, { strict: false }), 'notifyUsers');
    await call('PUT', path(ciro.userId), tesorera, { sponsor: beto.userId });
    const url = `/equipos/${teamId}/mis-cuentas`;
    expect(notify).toHaveBeenCalledWith([ciro.userId], {
      kind: 'charge-covered',
      charge: 'Arbitraje',
      opponent: 'Arbitraje',
      url,
    });
    expect(notify).toHaveBeenCalledWith([beto.userId], {
      kind: 'charge-sponsor',
      charge: 'Arbitraje',
      opponent: 'Arbitraje',
      url,
    });
    notify.mockRestore();
    const covered = ChargeResponseSchema.parse(
      (await call('PUT', path(ana.userId), tesorera, { sponsor: 'team' })).json(),
    );
    // El tesorero ve quién cubre a quién; lo del equipo sale del saldo y se cuenta aparte.
    expect(covered.shares.map((s) => [s.displayName, s.status, s.sponsor])).toEqual([
      ['ana', 'covered', { kind: 'team' }],
      ['beto', 'pending', null],
      ['ciro', 'pending', { kind: 'member', userId: beto.userId, displayName: 'beto' }],
    ]);
    expect(covered.charge).toMatchObject({
      teamCovered: 8_000,
      paidPeople: 1,
      balance: { billed: 16_000, collected: 0, pending: 16_000 },
    });
    // A lo que cubre el equipo no se le registran pagos.
    expect(
      (
        await call('POST', `/charges/${arbitraje.id}/payments`, tesorera, {
          userId: ana.userId,
          amount: 1_000,
          method: 'cash',
          paidOn: today,
        })
      ).json(),
    ).toMatchObject({ error: { code: 'SHARE_COVERED' } });

    // Ciro la ve cubierta, sin saber quién, y ya no la debe ni puede reportarla.
    const ciroView = MyChargesResponseSchema.parse((await call('GET', '/me/charges', ciro)).json());
    const ciroItem = ciroView.items.find((i) => i.charge.id === arbitraje.id)!;
    expect(ciroItem).toMatchObject({ forPlayer: null, status: 'covered', payments: [] });
    expect(JSON.stringify(ciroView)).not.toContain(beto.userId);
    expect(ciroView.owed).toBe(23_400 + 15_000);
    expect(
      (
        await call('POST', `/me/charges/${arbitraje.id}/payments`, ciro, {
          amount: 8_000,
          method: 'cash',
          paidOn: today,
        })
      ).json(),
    ).toMatchObject({ error: { code: 'SHARE_COVERED' } });

    // Beto ve las dos: la suya y la de Ciro, y paga la de Ciro con su "Ya pagué".
    const betoView = MyChargesResponseSchema.parse((await call('GET', '/me/charges', beto)).json());
    expect(
      betoView.items
        .filter((i) => i.charge.id === arbitraje.id)
        .map((i) => [i.forPlayer?.displayName ?? null, i.amount, i.status]),
    ).toEqual([
      [null, 8_000, 'pending'],
      ['ciro', 8_000, 'pending'],
    ]);
    expect(betoView.owed).toBe(16_000);
    // Ana no patrocina a Ciro: no puede pagar por él.
    expect(
      (
        await call('POST', `/me/charges/${arbitraje.id}/payments`, ana, {
          amount: 8_000,
          method: 'cash',
          paidOn: today,
          forUserId: ciro.userId,
        })
      ).statusCode,
    ).toBe(403);
    const paidFor = await call('POST', `/me/charges/${arbitraje.id}/payments`, beto, {
      amount: 8_000,
      method: 'nequi',
      paidOn: today,
      forUserId: ciro.userId,
    });
    expect(paidFor.statusCode).toBe(201);

    // Con un pago por confirmar, el patrocinio no se quita; sin pagos, sí (lo de Ana vuelve).
    expect(
      (await call('PUT', path(ciro.userId), tesorera, { sponsor: null })).json(),
    ).toMatchObject({ error: { code: 'SPONSOR_NOT_ALLOWED' } });
    const back = ChargeResponseSchema.parse(
      (await call('PUT', path(ana.userId), tesorera, { sponsor: null })).json(),
    );
    expect(back.shares.find((s) => s.userId === ana.userId)).toMatchObject({
      status: 'pending',
      sponsor: null,
    });
    expect(back.charge.teamCovered).toBe(0);

    // También al crear: la de Ana la asume Beto y la de Ciro, el equipo.
    const base = { kind: 'uniform', split: 'per_person', amount: 50_000 };
    const playerIds = [ana.userId, beto.userId, ciro.userId];
    expect(
      (
        await call('POST', '/charges', tesorera, {
          ...base,
          playerIds,
          sponsors: [{ userId: ana.userId, sponsor: ana.userId }],
        })
      ).json(),
    ).toMatchObject({ error: { code: 'SPONSOR_NOT_ALLOWED' } });
    expect(
      (
        await call('POST', '/charges', tesorera, {
          ...base,
          playerIds: [ana.userId],
          sponsors: [{ userId: ciro.userId, sponsor: 'team' }],
        })
      ).json(),
    ).toMatchObject({ error: { code: 'NOT_IN_CHARGE' } });
    const avisos = vi.spyOn(app.get<Notifier>(NOTIFIER, { strict: false }), 'notifyUsers');
    const uniformes = ChargeResponseSchema.parse(
      (
        await call('POST', '/charges', tesorera, {
          ...base,
          playerIds,
          sponsors: [
            { userId: ana.userId, sponsor: beto.userId },
            { userId: ciro.userId, sponsor: 'team' },
          ],
        })
      ).json(),
    );
    expect(uniformes.shares.map((s) => [s.displayName, s.status, s.sponsor?.kind ?? null])).toEqual(
      [
        ['ana', 'pending', 'member'],
        ['beto', 'pending', null],
        ['ciro', 'covered', 'team'],
      ],
    );
    expect(uniformes.charge).toMatchObject({ teamCovered: 50_000, balance: { billed: 100_000 } });
    const kinds = avisos.mock.calls.map(([ids, m]) => [m.kind, ids]);
    expect(kinds).toEqual([
      ['charge-created', [beto.userId]],
      ['charge-covered', [ana.userId, ciro.userId]],
      ['charge-sponsor', [beto.userId]],
    ]);
    avisos.mockRestore();
  });
});
