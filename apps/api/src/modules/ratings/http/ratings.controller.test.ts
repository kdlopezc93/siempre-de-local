import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import {
  ErrorBodySchema,
  MyCardResponseSchema,
  POLICY_VERSION,
  RatingAttributesResponseSchema,
  RatingHistoryResponseSchema,
  RatingResponseSchema,
  SquadResponseSchema,
  TeamResponseSchema,
} from '@sdl/contracts';
import { RATING_ATTRIBUTE_CODES, RATING_ATTRIBUTES } from '@sdl/domain';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createDb, type DbConnection } from '../../../shared/db/client.js';
import { bootApp, TEST_ENV } from '../../../test/app.js';
import { startMigratedPostgres } from '../../../test/postgres.js';
import { seedUserWithSession, type SeededUser } from '../../../test/sessions.js';
import { bootstrapTeam } from '../../teams/infrastructure/bootstrap-team.js';
import { teamMembership } from '../../teams/infrastructure/schema.js';
import { ratingAttribute } from '../infrastructure/schema.js';

const OUTFIELD = { PAC: 80, SHO: 60, PAS: 70, DRI: 75, DEF: 40, PHY: 65 };
const GOALKEEPER = { GK_DIV: 70, GK_HAN: 60, GK_KIC: 50, GK_REF: 80, GK_SPD: 70, GK_POS: 65 };

describe('tarjeta 0–99', () => {
  let container: StartedPostgreSqlContainer;
  let connection: DbConnection;
  let app: NestFastifyApplication;
  let owner: SeededUser, coach: SeededUser, assistant: SeededUser, player: SeededUser;
  let outsider: SeededUser;
  let teamId: string;

  const call = (
    method: 'GET' | 'POST' | 'PATCH',
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

  const rate = (who: SeededUser, values: object, playerId = player.userId) =>
    call('POST', `/teams/${teamId}/players/${playerId}/ratings`, who, { values, notes: 'Rápido' });

  beforeAll(async () => {
    container = await startMigratedPostgres();
    const url = container.getConnectionUri();
    connection = createDb(url);
    const seed = (name: string) => seedUserWithSession(url, { name, email: `${name}@example.com` });
    [owner, coach, assistant, player, outsider] = [
      await seed('dueno'),
      await seed('profe'),
      await seed('asistente'),
      await seed('jugadora'),
      await seed('otro'),
    ];
    ({ teamId } = await bootstrapTeam(connection.db, {
      clubName: 'Los del Barrio',
      clubSlug: 'los-del-barrio',
      teamName: 'Primer equipo',
      format: 'F11',
      season: '2026',
      ownerEmail: 'dueno@example.com',
      coachEmail: 'profe@example.com',
    }));
    await connection.db.insert(teamMembership).values([
      { teamId, userId: assistant.userId, role: 'assistant' },
      { teamId, userId: player.userId, role: 'player' },
    ]);
    app = await bootApp(url);
    for (const who of [owner, coach, assistant, player, outsider]) {
      await call('POST', '/me/consent', who, { policyVersion: POLICY_VERSION, ageConfirmed: true });
    }
  });

  afterAll(async () => {
    await app?.close();
    await connection?.pool.end();
    vi.unstubAllEnvs();
    await container?.stop();
  });

  it('la migración siembra el catálogo igual que el dominio', async () => {
    const rows = await connection.db.select().from(ratingAttribute);
    expect(Object.fromEntries(rows.map((r) => [r.code, [r.nameEs, r.group]]))).toEqual(
      Object.fromEntries(
        RATING_ATTRIBUTE_CODES.map((code) => [
          code,
          [RATING_ATTRIBUTES[code].name, RATING_ATTRIBUTES[code].group],
        ]),
      ),
    );
    const catalog = RatingAttributesResponseSchema.parse(
      (await call('GET', '/rating-attributes', player)).json(),
    );
    expect(catalog.attributes).toHaveLength(12);
    expect(catalog.anchors[0]).toEqual({ min: 85, max: 99, label: expect.any(String) });
  });

  it('coach y asistente puntúan; cada foto trae sus medias por posición', async () => {
    const first = await rate(coach, OUTFIELD);
    expect(first.statusCode).toBe(201);
    const { rating } = RatingResponseSchema.parse(first.json());
    expect(rating.ratedBy?.id).toBe(coach.userId);
    expect(rating.positionAverages).toMatchObject({ EXT: 74, DFC: 56, DC: 67 });
    expect(rating.positionAverages.POR).toBeUndefined();

    const second = await rate(assistant, { ...OUTFIELD, ...GOALKEEPER, PAC: 85 });
    expect(second.statusCode).toBe(201);
    expect(RatingResponseSchema.parse(second.json()).rating.positionAverages.POR).toBe(68);

    const history = RatingHistoryResponseSchema.parse(
      (await call('GET', `/teams/${teamId}/players/${player.userId}/ratings`, owner)).json(),
    );
    expect(history.items.map((r) => r.ratedBy?.id)).toEqual([assistant.userId, coach.userId]);
    expect(history.items[0]!.values.PAC).toBe(85);
  });

  it('la plantilla muestra la foto más reciente', async () => {
    const { players } = SquadResponseSchema.parse(
      (await call('GET', `/teams/${teamId}/squad`, coach)).json(),
    );
    expect(players[0]!.card?.positionAverages.POR).toBe(68);
  });

  it('quien puntúa le pone la posición a la tarjeta, aunque su mejor media sea otra (02 §7.4)', async () => {
    const values = { ...OUTFIELD, ...GOALKEEPER, PAC: 85 };
    const path = `/teams/${teamId}/players/${player.userId}/ratings`;
    const res = await call('POST', path, coach, { values, position: 'LAT' });
    expect(res.statusCode).toBe(201);
    const { rating } = RatingResponseSchema.parse(res.json());
    expect(rating.position).toBe('LAT');
    expect(rating.positionAverages.EXT).toBeGreaterThan(rating.positionAverages.LAT!);

    // Las de antes, sin posición: encabeza su mejor media.
    const history = RatingHistoryResponseSchema.parse((await call('GET', path, coach)).json());
    expect(history.items.map((r) => r.position)).toEqual(['LAT', null, null]);
    const { players } = SquadResponseSchema.parse(
      (await call('GET', `/teams/${teamId}/squad`, coach)).json(),
    );
    expect(players[0]!.card?.position).toBe('LAT');

    // Portero, solo con sus atributos.
    const keeper = await call('POST', path, coach, { values: OUTFIELD, position: 'POR' });
    expect(keeper.statusCode).toBe(422);
    expect(ErrorBodySchema.parse(keeper.json()).error.code).toBe('RATING_POSITION_WITHOUT_AVERAGE');
    expect((await call('POST', path, coach, { values, position: 'XX' })).statusCode).toBe(400);
  });

  it('valida la foto: faltantes, portero a medias y fuera de rango', async () => {
    const { PHY: _, ...missing } = OUTFIELD;
    for (const values of [missing, { ...OUTFIELD, GK_DIV: 50 }, { ...OUTFIELD, PAC: 100 }]) {
      const res = await rate(coach, values);
      expect(res.statusCode).toBe(400);
    }
  });

  it('ni el jugador, ni el admin del club, ni alguien de afuera puntúan', async () => {
    for (const who of [player, owner, outsider]) {
      expect((await rate(who, OUTFIELD)).statusCode).toBe(403);
    }
    expect((await rate(coach, OUTFIELD, outsider.userId)).json()).toMatchObject({
      error: { code: 'PLAYER_NOT_IN_TEAM' },
    });
    // El jugador no ve el histórico (con notas y autor).
    const history = await call('GET', `/teams/${teamId}/players/${player.userId}/ratings`, player);
    expect(history.statusCode).toBe(403);
  });

  it('el jugador ve su tarjeta sin notas ni autor, y el entrenador puede ocultarla (D8)', async () => {
    const visible = await call('GET', `/me/card?teamId=${teamId}`, player);
    expect(visible.statusCode).toBe(200);
    const { card } = MyCardResponseSchema.parse(visible.json());
    expect(card?.values.PAC).toBe(85);
    expect(card?.position).toBe('LAT');
    expect(JSON.stringify(visible.json())).not.toMatch(/Rápido|ratedBy|notes/);

    // Solo el coach o el admin del club cambian el ajuste.
    expect(
      (await call('PATCH', `/teams/${teamId}`, assistant, { ratingsVisibleToPlayers: false }))
        .statusCode,
    ).toBe(403);
    const patched = await call('PATCH', `/teams/${teamId}`, coach, {
      ratingsVisibleToPlayers: false,
    });
    expect(TeamResponseSchema.parse(patched.json()).team.ratingsVisibleToPlayers).toBe(false);

    const hidden = await call('GET', `/me/card?teamId=${teamId}`, player);
    expect(hidden.statusCode).toBe(403);
    expect(ErrorBodySchema.parse(hidden.json()).error.code).toBe('CARD_HIDDEN');

    await call('PATCH', `/teams/${teamId}`, owner, { ratingsVisibleToPlayers: true });
    expect((await call('GET', `/me/card?teamId=${teamId}`, player)).statusCode).toBe(200);
  });

  it('quien no juega en el equipo no tiene tarjeta ahí', async () => {
    const res = await call('GET', `/me/card?teamId=${teamId}`, coach);
    expect(res.statusCode).toBe(404);
  });

  it('quién valora a quién: nadie a sí mismo; al entrenador que juega, la asistente (04 §2.2)', async () => {
    // El entrenador y la asistente también juegan.
    await connection.db.insert(teamMembership).values([
      { teamId, userId: coach.userId, role: 'player' },
      { teamId, userId: assistant.userId, role: 'player' },
    ]);
    const code = async (res: Awaited<ReturnType<typeof rate>>) => {
      expect(res.statusCode).toBe(403);
      return ErrorBodySchema.parse(res.json()).error;
    };

    expect((await rate(coach, OUTFIELD, assistant.userId)).statusCode).toBe(201);
    // Al entrenador que también juega lo valora la asistente (2026-10-25).
    expect((await rate(assistant, OUTFIELD, coach.userId)).statusCode).toBe(201);
    expect((await code(await rate(assistant, OUTFIELD, assistant.userId))).message).toBe(
      'No puedes valorarte a ti mismo.',
    );
    expect((await code(await rate(coach, OUTFIELD, coach.userId))).code).toBe('CANNOT_RATE_PLAYER');

    // La plantilla dice a quién puede valorar cada uno.
    const squad = SquadResponseSchema.parse(
      (await call('GET', `/teams/${teamId}/squad`, assistant)).json(),
    );
    const canRate = Object.fromEntries(squad.players.map((p) => [p.userId, p.canRate]));
    expect(canRate).toEqual({
      [player.userId]: true,
      [coach.userId]: true,
      [assistant.userId]: false,
    });
  });
});
