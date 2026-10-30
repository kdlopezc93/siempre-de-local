import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import {
  MatchListResponseSchema,
  TournamentListResponseSchema,
  TournamentResponseSchema,
  MatchRatingsResponseSchema,
  MatchResponseSchema,
  PlayerMatchRatingsResponseSchema,
} from '@sdl/contracts';
import { and, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createDb, type DbConnection } from '../../../shared/db/client.js';
import { bootApp, TEST_ENV } from '../../../test/app.js';
import { startMigratedPostgres } from '../../../test/postgres.js';
import { seedUserWithSession, type SeededUser } from '../../../test/sessions.js';
import { bootstrapTeam } from '../../teams/infrastructure/bootstrap-team.js';
import { teamMembership } from '../../teams/infrastructure/schema.js';
import { NOTIFIER, type Notifier } from '../../../shared/notifications/notifier.port.js';
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
      kind: 'friendly',
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
      editable: true,
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
    expect(seen.match.replies).toEqual({ yes: 2, no: 0, pending: 0, injured: 0 });
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
          kind: 'friendly',
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

  it('cancelado, queda fijo; empezado, ya no se responde (D17)', async () => {
    const { match } = MatchResponseSchema.parse((await convocar()).json());
    const cancelled = await call('PATCH', `/${match.id}`, coach, { status: 'cancelled' });
    expect(MatchResponseSchema.parse(cancelled.json()).match).toMatchObject({
      status: 'cancelled',
      open: false,
      editable: false,
    });
    const late = await call('PUT', `/${match.id}/reply`, ana, { reply: 'yes' });
    expect(late.statusCode).toBe(409);
    expect(late.json()).toMatchObject({ error: { code: 'MATCH_CLOSED' } });

    expect((await call('PATCH', `/${match.id}`, coach, { place: 'Otra' })).json()).toMatchObject({
      error: { code: 'MATCH_CLOSED' },
    });

    // Uno por jugar no se pasa al pasado.
    const { match: other } = MatchResponseSchema.parse((await convocar()).json());
    expect(
      (await call('PATCH', `/${other.id}`, coach, { startsAt: inDays(-1) })).json(),
    ).toMatchObject({ error: { code: 'MATCH_IN_PAST' } });
    // El partido empezó (se mueve la hora en la base: el API no deja ponerla en el pasado).
    await connection.db
      .update(teamMatch)
      .set({ startsAt: new Date(Date.now() - 60_000) })
      .where(eq(teamMatch.id, other.id));
    const started = await call('PUT', `/${other.id}/reply`, ana, { reply: 'yes' });
    expect(started.json()).toMatchObject({ error: { code: 'MATCH_CLOSED' } });
  });

  it('hasta cargar el resultado, el cuerpo técnico lo corrige o lo cancela aunque ya pasó la hora', async () => {
    const started = async () => {
      const { match } = MatchResponseSchema.parse((await convocar()).json());
      await connection.db
        .update(teamMatch)
        .set({ startsAt: new Date(Date.now() - 3_600_000) })
        .where(eq(teamMatch.id, match.id));
      return match.id;
    };

    // Se guardó a la 1:30 a. m. en vez de p. m.: se corrige a otra hora pasada o a una futura.
    const wrongTime = await started();
    const earlier = await call('PATCH', `/${wrongTime}`, coach, { startsAt: inDays(-1) });
    expect(MatchResponseSchema.parse(earlier.json()).match).toMatchObject({
      open: false,
      editable: true,
    });
    const later = await call('PATCH', `/${wrongTime}`, coach, { startsAt: inDays(1) });
    // A futuro se vuelve a abrir para responder.
    expect(MatchResponseSchema.parse(later.json()).match).toMatchObject({
      open: true,
      editable: true,
    });
    expect((await call('PATCH', `/${wrongTime}`, ana, { place: 'Otra' })).statusCode).toBe(403);

    // Se cayó: se cancela aunque ya pasó la hora, y queda cancelado.
    const fell = await started();
    const cancelled = await call('PATCH', `/${fell}`, coach, { status: 'cancelled' });
    expect(MatchResponseSchema.parse(cancelled.json()).match).toMatchObject({
      status: 'cancelled',
      editable: false,
    });

    // Con resultado, queda en la historia: se corrige el resultado, no el partido.
    const played = await started();
    await call('PUT', `/${played}/result`, coach, {
      goalsFor: 1,
      goalsAgainst: 0,
      figurePlayerId: null,
    });
    const closed = await call('PATCH', `/${played}`, coach, { status: 'cancelled' });
    expect(closed.statusCode).toBe(409);
    expect(closed.json()).toMatchObject({ error: { code: 'MATCH_CLOSED' } });
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
    const notify = vi.spyOn(app.get<Notifier>(NOTIFIER, { strict: false }), 'notifyUsers');
    const saved = MatchResponseSchema.parse(
      (await call('PUT', `/${match.id}/result`, coach, result)).json(),
    );
    // La figura recibe la felicitación una vez; volver a guardar no la repite.
    expect(notify).toHaveBeenCalledExactlyOnceWith([ana.userId], {
      kind: 'match-figure',
      opponent: 'Los Pibes',
      startsAt: expect.any(String),
      url: `/equipos/${teamId}/partidos/${match.id}`,
    });
    await call('PUT', `/${match.id}/result`, coach, result);
    expect(notify).toHaveBeenCalledOnce();
    notify.mockRestore();
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

    // Quién valora a quién (04 §2.2): el entrenador que también juega no se evalúa a sí mismo.
    await connection.db
      .insert(teamMembership)
      .values({ teamId, userId: coach.userId, role: 'player', jerseyNumber: 10 });
    const self = await call('PUT', `/${match.id}/ratings/${coach.userId}`, coach, { rating: 5 });
    expect(self.statusCode).toBe(403);
    expect(self.json()).toMatchObject({ error: { code: 'CANNOT_RATE_PLAYER' } });
    const { roster } = MatchResponseSchema.parse((await call('GET', `/${match.id}`, coach)).json());
    expect(roster?.find((p) => p.playerId === coach.userId)?.canRate).toBe(false);
    expect(roster?.find((p) => p.playerId === ana.userId)?.canRate).toBe(true);
    await connection.db
      .delete(teamMembership)
      .where(and(eq(teamMembership.userId, coach.userId), eq(teamMembership.role, 'player')));

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

  it('¿quién vino?: lista desde la hora, también en entrenos; reemplaza a los que dijeron voy', async () => {
    const { match } = MatchResponseSchema.parse((await convocar()).json());
    await call('PUT', `/${match.id}/reply`, ana, { reply: 'yes' });
    await call('PUT', `/${match.id}/reply`, beto, { reply: 'no' });
    const early = await call('PUT', `/${match.id}/attendance`, coach, { playerIds: [] });
    expect(early.statusCode).toBe(409);
    expect(early.json()).toMatchObject({ error: { code: 'MATCH_NOT_STARTED' } });

    await connection.db
      .update(teamMatch)
      .set({ startsAt: new Date(Date.now() - 60_000) })
      .where(eq(teamMatch.id, match.id));

    // Sin lista, vinieron los que dijeron voy.
    const before = MatchResponseSchema.parse((await call('GET', `/${match.id}`, coach)).json());
    expect(before.match.attendanceTaken).toBe(false);
    expect(before.roster!.map((r) => [r.displayName, r.came])).toEqual([
      ['ana', true],
      ['beto', false],
    ]);

    // Solo el cuerpo técnico pasa lista, y solo con jugadores del equipo.
    const list = { playerIds: [beto.userId] };
    expect((await call('PUT', `/${match.id}/attendance`, ana, list)).statusCode).toBe(403);
    expect(
      (
        await call('PUT', `/${match.id}/attendance`, coach, { playerIds: [outsider.userId] })
      ).json(),
    ).toMatchObject({ error: { code: 'PLAYER_NOT_IN_TEAM' } });

    // La lista manda: llegó beto (había dicho que no) y ana no apareció.
    const taken = await call('PUT', `/${match.id}/attendance`, coach, list);
    expect(taken.statusCode).toBe(200);
    const after = MatchResponseSchema.parse(taken.json());
    expect(after.match.attendanceTaken).toBe(true);
    expect(after.roster!.map((r) => [r.displayName, r.came])).toEqual([
      ['ana', false],
      ['beto', true],
    ]);
    // Se corrige sin plazo, y la lista entera reemplaza la anterior.
    const fixed = MatchResponseSchema.parse(
      (
        await call('PUT', `/${match.id}/attendance`, coach, {
          playerIds: [ana.userId, beto.userId, ana.userId],
        })
      ).json(),
    );
    expect(fixed.roster!.every((r) => r.came)).toBe(true);

    // El tesorero (2026-10-30) también pasa lista y ve quién respondió qué; el resultado, no.
    await connection.db
      .insert(teamMembership)
      .values({ teamId, userId: outsider.userId, role: 'treasurer' });
    const asTreasurer = await call('PUT', `/${match.id}/attendance`, outsider, list);
    expect(asTreasurer.statusCode).toBe(200);
    expect(MatchResponseSchema.parse(asTreasurer.json()).roster).not.toBeNull();
    expect(
      (
        await call('PUT', `/${match.id}/result`, outsider, {
          goalsFor: 1,
          goalsAgainst: 0,
          figurePlayerId: null,
        })
      ).statusCode,
    ).toBe(403);
    await connection.db
      .delete(teamMembership)
      .where(and(eq(teamMembership.userId, outsider.userId), eq(teamMembership.role, 'treasurer')));

    // En el entreno también se pasa lista.
    const training = MatchResponseSchema.parse(
      (await convocar({ kind: 'training', opponent: null })).json(),
    ).match;
    await connection.db
      .update(teamMatch)
      .set({ startsAt: new Date(Date.now() - 60_000) })
      .where(eq(teamMatch.id, training.id));
    expect(
      (await call('PUT', `/${training.id}/attendance`, coach, { playerIds: [ana.userId] }))
        .statusCode,
    ).toBe(200);
  });

  it('torneos del equipo: el cuerpo técnico los crea, el nombre no se repite y todos los ven', async () => {
    const tournaments = (method: 'GET' | 'POST', who: SeededUser, body?: object) =>
      call(method, '', who, body, `/teams/${teamId}/tournaments`);
    const created = await tournaments('POST', coach, { name: 'Liga del barrio 2026' });
    expect(created.statusCode).toBe(201);
    const { tournament } = TournamentResponseSchema.parse(created.json());
    expect(tournament.name).toBe('Liga del barrio 2026');
    // Sin importar mayúsculas.
    const again = await tournaments('POST', coach, { name: 'liga del barrio 2026' });
    expect(again.statusCode).toBe(409);
    expect(again.json()).toMatchObject({ error: { code: 'TOURNAMENT_NAME_TAKEN' } });
    expect((await tournaments('POST', ana, { name: 'Copa' })).statusCode).toBe(403);
    const list = TournamentListResponseSchema.parse((await tournaments('GET', ana)).json());
    expect(list.items.map((t) => t.name)).toContain('Liga del barrio 2026');
  });

  it('tipo de convocatoria: campeonato con su torneo, amistoso sin torneo, entreno sin rival', async () => {
    const { tournament } = TournamentResponseSchema.parse(
      (
        await call('POST', '', coach, { name: 'Copa del barrio' }, `/teams/${teamId}/tournaments`)
      ).json(),
    );
    const sinTorneo = await convocar({ kind: 'championship' });
    expect(sinTorneo.statusCode).toBe(422);
    expect(sinTorneo.json()).toMatchObject({
      error: { code: 'MATCH_KIND_FIELDS', message: 'Elige el torneo.' },
    });
    const campeonato = MatchResponseSchema.parse(
      (await convocar({ kind: 'championship', tournamentId: tournament.id })).json(),
    ).match;
    expect(campeonato).toMatchObject({
      kind: 'championship',
      tournament: { id: tournament.id, name: 'Copa del barrio' },
    });
    expect((await convocar({ tournamentId: tournament.id })).json()).toMatchObject({
      error: { code: 'MATCH_KIND_FIELDS', message: 'Un amistoso no es de un torneo.' },
    });

    // El entreno: sin rival; con rival, no.
    expect((await convocar({ kind: 'training' })).json()).toMatchObject({
      error: { code: 'MATCH_KIND_FIELDS', message: 'Un entrenamiento no tiene rival.' },
    });
    const entreno = MatchResponseSchema.parse(
      (await convocar({ kind: 'training', opponent: null })).json(),
    ).match;
    expect(entreno).toMatchObject({ kind: 'training', opponent: null, tournament: null });
    // Se responde voy / no voy como siempre.
    await call('PUT', `/${entreno.id}/reply`, ana, { reply: 'yes' });
    // Pero no lleva resultado ni evaluaciones, ni aunque ya haya pasado la hora.
    await connection.db
      .update(teamMatch)
      .set({ startsAt: new Date(Date.now() - 60_000) })
      .where(eq(teamMatch.id, entreno.id));
    const resultado = await call('PUT', `/${entreno.id}/result`, coach, {
      goalsFor: 1,
      goalsAgainst: 0,
      figurePlayerId: null,
    });
    expect(resultado.json()).toMatchObject({ error: { code: 'MATCH_IS_TRAINING' } });
    expect(
      (await call('PUT', `/${entreno.id}/ratings/${ana.userId}`, coach, { rating: 4 })).json(),
    ).toMatchObject({ error: { code: 'MATCH_IS_TRAINING' } });
  });

  it('los partidos de antes quedaron de campeonato sin torneo: se les asigna aunque tengan resultado', async () => {
    const [viejo] = await connection.db
      .insert(teamMatch)
      .values({
        teamId,
        kind: 'championship',
        format: 'F11',
        startsAt: new Date(Date.now() - 7 * 86_400_000),
        place: 'La 14',
        opponent: 'Veteranos',
        goalsFor: 2,
        goalsAgainst: 1,
        resultAt: new Date(),
      })
      .returning({ id: teamMatch.id });
    const { tournament } = TournamentResponseSchema.parse(
      (
        await call('POST', '', coach, { name: 'Liga de antes' }, `/teams/${teamId}/tournaments`)
      ).json(),
    );
    const asignado = await call('PATCH', `/${viejo!.id}`, coach, { tournamentId: tournament.id });
    expect(asignado.statusCode).toBe(200);
    expect(MatchResponseSchema.parse(asignado.json()).match.tournament).toEqual({
      id: tournament.id,
      name: 'Liga de antes',
    });
    // Lo demás sigue cerrado: tiene resultado.
    expect((await call('PATCH', `/${viejo!.id}`, coach, { place: 'Otra' })).json()).toMatchObject({
      error: { code: 'MATCH_CLOSED' },
    });
  });
});
