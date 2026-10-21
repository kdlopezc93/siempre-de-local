import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import {
  AttemptListResponseSchema,
  AttemptResultSchema,
  ErrorBodySchema,
  POLICY_VERSION,
  QuestionnaireResponseSchema,
  type QuestionnaireResponse,
  type SubmitAttemptRequest,
} from '@sdl/contracts';
import { scorePosition } from '@sdl/domain';
import { and, count, eq, inArray } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createDb, type DbConnection } from '../../../shared/db/client.js';
import { bootApp, TEST_ENV } from '../../../test/app.js';
import { startMigratedPostgres } from '../../../test/postgres.js';
import { seedUserWithSession, type SeededUser } from '../../../test/sessions.js';
import { prepOption } from '../../questionnaires/infrastructure/schema.js';
import { ORIENTATION_V1 } from '../../questionnaires/infrastructure/seed/orientation-v1.content.js';
import { seedOrientationContent } from '../../questionnaires/infrastructure/seed/seed-orientation.js';
import { bootstrapTeam } from '../../teams/infrastructure/bootstrap-team.js';
import { teamMembership } from '../../teams/infrastructure/schema.js';
import { attemptItem, quizAttempt } from '../infrastructure/schema.js';

describe('test de orientación (API)', () => {
  let container: StartedPostgreSqlContainer;
  let connection: DbConnection;
  let app: NestFastifyApplication;
  let url: string;
  let coach: SeededUser, player: SeededUser, otherPlayer: SeededUser;
  let teamId: string;
  let questionnaire: QuestionnaireResponse;

  const call = (method: 'GET' | 'POST', path: string, who?: SeededUser, payload?: object) =>
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

  async function seedPlayer(name: string, { consent = true, role = 'player' as const } = {}) {
    const user = await seedUserWithSession(url, { name, email: `${name}@example.com` });
    if (consent) {
      await call('POST', '/me/consent', user, {
        policyVersion: POLICY_VERSION,
        ageConfirmed: true,
      });
    }
    await connection.db.insert(teamMembership).values({ teamId, userId: user.userId, role });
    return user;
  }

  /**
   * Lo que hace la PWA: 15 ítems, una respuesta cada uno, ganador calculado en el
   * celular con @sdl/domain y las 8 de preparación de esa posición.
   */
  function buildAttempt(
    pick: (optionIds: string[], i: number) => string = (ids) => ids[0]!,
    overrides: Partial<SubmitAttemptRequest> = {},
  ): SubmitAttemptRequest {
    const items = questionnaire.positionItems.slice(0, questionnaire.positionItemsPerAttempt);
    const answers = items.map((item, i) =>
      pick(
        item.options.map((o) => o.id),
        i,
      ),
    );
    const winner = scorePosition(
      items.map((item) => ({ id: item.id, options: item.options })),
      answers,
      'F8',
    )[0]!.pos;
    const prep = questionnaire.prepItems.filter((p) => p.position === winner);
    return {
      clientAttemptId: randomUUID(),
      teamId,
      questionnaireVersionId: questionnaire.versionId,
      format: 'F8',
      startedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      submittedAt: new Date().toISOString(),
      positionItems: items.map((item, i) => ({
        itemId: item.id,
        shownOrder: i + 1,
        optionOrder: item.options.map((o) => o.id).reverse(),
        answerOptionId: answers[i]!,
      })),
      prepItems: prep.map((item, i) => ({
        itemId: item.id,
        shownOrder: i + 1,
        optionOrder: item.options.map((o) => o.id),
        answerOptionId: item.options[0]!.id,
      })),
      clientResult: { winner },
      ...overrides,
    };
  }

  beforeAll(async () => {
    container = await startMigratedPostgres();
    url = container.getConnectionUri();
    connection = createDb(url);
    await seedOrientationContent(connection.db, ORIENTATION_V1);
    coach = await seedUserWithSession(url, { name: 'coach', email: 'coach@example.com' });
    ({ teamId } = await bootstrapTeam(connection.db, {
      clubName: 'Los del Barrio',
      clubSlug: 'los-del-barrio',
      teamName: 'Fútbol 8',
      format: 'F8',
      season: '2026',
      ownerEmail: 'coach@example.com',
      coachEmail: 'coach@example.com',
    }));
    app = await bootApp(url);
    player = await seedPlayer('jugador');
    otherPlayer = await seedPlayer('otro');
    questionnaire = QuestionnaireResponseSchema.parse(
      (await call('GET', '/questionnaires/current', player)).json(),
    );
  });

  afterAll(async () => {
    await app?.close();
    await connection?.pool.end();
    vi.unstubAllEnvs();
    await container?.stop();
  });

  describe('GET /questionnaires/current', () => {
    it('trae la versión publicada completa y nunca la respuesta correcta', async () => {
      const res = await call('GET', '/questionnaires/current', player);
      expect(questionnaire.positionItems).toHaveLength(31);
      expect(questionnaire.prepItems).toHaveLength(64);
      // Ninguna clave del JSON delata la correcta (los textos sí pueden decir "correcta").
      const keys = new Set<string>();
      JSON.parse(res.body, (key, value: unknown) => (keys.add(key), value));
      expect([...keys].filter((key) => /correct|right|answer/i.test(key))).toEqual([]);
    });

    it('usa la versión como ETag y responde 304 si no cambió', async () => {
      const first = await call('GET', '/questionnaires/current', player);
      expect(first.headers.etag).toBe(`"${questionnaire.versionId}"`);
      const again = await app.inject({
        method: 'GET',
        url: '/api/v1/questionnaires/current',
        headers: { cookie: player.cookie, 'if-none-match': first.headers.etag as string },
      });
      expect(again.statusCode).toBe(304);
    });
  });

  describe('POST /attempts', () => {
    it('calcula el resultado oficial en el servidor y guarda las respuestas crudas', async () => {
      const attempt = buildAttempt((ids, i) => ids[i % ids.length]!);
      const res = await call('POST', '/attempts', player, attempt);
      expect(res.statusCode).toBe(201);

      const result = AttemptResultSchema.parse(res.json());
      expect(result.winner).toBe(attempt.clientResult.winner);
      expect(result.ranking).toHaveLength(6); // F8: sin pivote ni mediapunta
      expect(result.podium).toEqual(result.ranking.slice(0, 3).map((r) => r.pos));
      expect(result.prep.total).toBe(8);

      const items = await connection.db
        .select({ n: count() })
        .from(attemptItem)
        .where(eq(attemptItem.attemptId, result.attemptId));
      expect(items[0]!.n).toBe(23);
    });

    it('acertar las 8 de preparación da "muy preparado"', async () => {
      const attempt = buildAttempt();
      // El test lee las correctas de la BD; el API nunca las expone.
      const correct = await connection.db
        .select({ id: prepOption.id, itemId: prepOption.itemId })
        .from(prepOption)
        .where(
          and(
            inArray(
              prepOption.itemId,
              attempt.prepItems.map((p) => p.itemId),
            ),
            eq(prepOption.isCorrect, true),
          ),
        );
      for (const served of attempt.prepItems) {
        served.answerOptionId = correct.find((c) => c.itemId === served.itemId)!.id;
      }
      const result = AttemptResultSchema.parse(
        (await call('POST', '/attempts', player, attempt)).json(),
      );
      expect(result.prep).toEqual({ score: 8, total: 8, band: 'very_prepared' });
    });

    it('un reenvío de la cola devuelve el mismo resultado sin duplicar, también a la vez', async () => {
      const attempt = buildAttempt();
      const [a, b] = await Promise.all([
        call('POST', '/attempts', player, attempt),
        call('POST', '/attempts', player, attempt),
      ]);
      expect([a.statusCode, b.statusCode].sort()).toEqual([200, 201]);
      expect(a.json()).toEqual(b.json());

      const again = await call('POST', '/attempts', player, attempt);
      expect(again.statusCode).toBe(200);
      expect(again.json()).toEqual(a.json());

      const rows = await connection.db
        .select({ n: count() })
        .from(quizAttempt)
        .where(eq(quizAttempt.clientAttemptId, attempt.clientAttemptId));
      expect(rows[0]!.n).toBe(1);
    });

    it('WINNER_MISMATCH si el celular calculó otro ganador', async () => {
      const attempt = buildAttempt();
      const wrong = attempt.clientResult.winner === 'POR' ? 'DC' : 'POR';
      const res = await call('POST', '/attempts', player, {
        ...attempt,
        clientResult: { winner: wrong },
      });
      expect(res.statusCode).toBe(422);
      expect(ErrorBodySchema.parse(res.json()).error.code).toBe('WINNER_MISMATCH');
    });

    it.each([
      [
        'faltan ítems de posición',
        (a: SubmitAttemptRequest) => ({ positionItems: a.positionItems.slice(1) }),
      ],
      [
        'un ítem repetido',
        (a: SubmitAttemptRequest) => ({
          positionItems: a.positionItems.map((s, i) =>
            i === 1 ? { ...a.positionItems[0]!, shownOrder: 2 } : s,
          ),
        }),
      ],
      [
        'una respuesta que no es del ítem',
        (a: SubmitAttemptRequest) => ({
          positionItems: a.positionItems.map((s, i) =>
            i === 0 ? { ...s, answerOptionId: a.positionItems[1]!.answerOptionId } : s,
          ),
        }),
      ],
      [
        'preparación de otra posición',
        (a: SubmitAttemptRequest) => {
          const other = questionnaire.prepItems.filter((p) => p.position !== a.clientResult.winner);
          return {
            prepItems: a.prepItems.map((s, i) => ({
              ...s,
              itemId: other[i]!.id,
              optionOrder: other[i]!.options.map((o) => o.id),
              answerOptionId: other[i]!.options[0]!.id,
            })),
          };
        },
      ],
      [
        'fechas al revés',
        () => ({ startedAt: new Date().toISOString(), submittedAt: '2026-01-01T00:00:00.000Z' }),
      ],
    ])('ATTEMPT_INVALID: %s', async (_, change) => {
      const attempt = buildAttempt();
      const res = await call('POST', '/attempts', player, { ...attempt, ...change(attempt) });
      expect(res.statusCode).toBe(422);
      expect(ErrorBodySchema.parse(res.json()).error.code).toBe('ATTEMPT_INVALID');
    });

    it('el formato tiene que ser el del equipo', async () => {
      const res = await call('POST', '/attempts', player, { ...buildAttempt(), format: 'F11' });
      expect(res.json()).toMatchObject({ error: { code: 'FORMAT_MISMATCH' } });
    });

    it('solo jugadores del equipo con la política aceptada', async () => {
      expect((await call('POST', '/attempts', coach, buildAttempt())).statusCode).toBe(403);

      const outsider = await seedUserWithSession(url, {
        name: 'fuera',
        email: 'fuera@example.com',
      });
      await call('POST', '/me/consent', outsider, {
        policyVersion: POLICY_VERSION,
        ageConfirmed: true,
      });
      expect((await call('POST', '/attempts', outsider, buildAttempt())).statusCode).toBe(403);

      const noConsent = await seedPlayer('sin-consentimiento', { consent: false });
      const res = await call('POST', '/attempts', noConsent, buildAttempt());
      expect(res.json()).toMatchObject({ error: { code: 'CONSENT_REQUIRED' } });
    });
  });

  describe('historial', () => {
    it('cada jugador ve sus intentos, del más reciente al más antiguo', async () => {
      const mine = AttemptListResponseSchema.parse(
        (await call('GET', '/me/attempts', player)).json(),
      );
      expect(mine.items.length).toBeGreaterThanOrEqual(3);
      const dates = mine.items.map((i) => i.submittedAt);
      expect(dates).toEqual([...dates].sort().reverse());

      const theirs = AttemptListResponseSchema.parse(
        (await call('GET', '/me/attempts', otherPlayer)).json(),
      );
      expect(theirs.items).toEqual([]);
    });

    it('el detalle de un intento ajeno responde 404', async () => {
      const [first] = AttemptListResponseSchema.parse(
        (await call('GET', '/me/attempts', player)).json(),
      ).items;
      expect((await call('GET', `/attempts/${first!.attemptId}`, player)).statusCode).toBe(200);
      expect((await call('GET', `/attempts/${first!.attemptId}`, otherPlayer)).statusCode).toBe(
        404,
      );
    });
  });
});
