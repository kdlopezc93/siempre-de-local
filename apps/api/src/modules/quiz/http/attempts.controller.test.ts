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
import { count, eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createDb, type DbConnection } from '../../../shared/db/client.js';
import { bootApp, TEST_ENV } from '../../../test/app.js';
import { startMigratedPostgres } from '../../../test/postgres.js';
import { seedUserWithSession, type SeededUser } from '../../../test/sessions.js';
import { questionnaireVersion } from '../../questionnaires/infrastructure/schema.js';
import { ORIENTATION_V1 } from '../../questionnaires/infrastructure/seed/orientation-v1.content.js';
import { ORIENTATION_V2 } from '../../questionnaires/infrastructure/seed/orientation-v2.content.js';
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

  async function seedPlayer(name: string, { consent = true } = {}) {
    const user = await seedUserWithSession(url, { name, email: `${name}@example.com` });
    if (consent) {
      await call('POST', '/me/consent', user, {
        policyVersion: POLICY_VERSION,
        ageConfirmed: true,
      });
    }
    await connection.db
      .insert(teamMembership)
      .values({ teamId, userId: user.userId, role: 'player' });
    return user;
  }

  /** Lo que hace la PWA: los ítems que tocan en la versión vigente, una respuesta cada uno. */
  function buildAttempt(
    pick: (optionIds: string[], i: number) => string = (ids) => ids[0]!,
  ): SubmitAttemptRequest {
    const items = questionnaire.positionItems.slice(0, questionnaire.positionItemsPerAttempt);
    return {
      clientAttemptId: randomUUID(),
      teamId,
      questionnaireVersionId: questionnaire.versionId,
      format: 'F8',
      startedAt: new Date(Date.now() - 5 * 60_000).toISOString(),
      submittedAt: new Date().toISOString(),
      positionItems: items.map((item, i) => {
        const ids = item.options.map((o) => o.id);
        return {
          itemId: item.id,
          shownOrder: i + 1,
          optionOrder: [...ids].reverse(),
          answerOptionId: pick(ids, i),
        };
      }),
    };
  }

  beforeAll(async () => {
    container = await startMigratedPostgres();
    url = container.getConnectionUri();
    connection = createDb(url);
    // Como `pnpm db:seed`: v1 y después v2, que la retira.
    await seedOrientationContent(connection.db, ORIENTATION_V1);
    await seedOrientationContent(connection.db, ORIENTATION_V2);
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
    it('trae la versión vigente (v2: 20 de 31, sin preparación) y nada de respuestas', async () => {
      const res = await call('GET', '/questionnaires/current', player);
      expect(questionnaire.label).toBe('v2');
      expect(questionnaire.positionItems).toHaveLength(31);
      expect(questionnaire.positionItemsPerAttempt).toBe(20);
      // Ninguna clave del JSON delata respuestas (los textos sí pueden decir "correcta").
      const keys = new Set<string>();
      JSON.parse(res.body, (key, value: unknown) => (keys.add(key), value));
      expect([...keys].filter((key) => /correct|right|answer|prep/i.test(key))).toEqual([]);
    });

    it('publicar v2 retiró la v1', async () => {
      const versions = await connection.db
        .select({ label: questionnaireVersion.label, status: questionnaireVersion.status })
        .from(questionnaireVersion)
        .orderBy(questionnaireVersion.label);
      expect(versions).toEqual([
        { label: 'v1', status: 'retired' },
        { label: 'v2', status: 'published' },
      ]);
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
    it('calcula el resultado oficial (podio) y guarda las respuestas crudas', async () => {
      const res = await call(
        'POST',
        '/attempts',
        player,
        buildAttempt((ids, i) => ids[i % ids.length]!),
      );
      expect(res.statusCode).toBe(201);

      const result = AttemptResultSchema.parse(res.json());
      expect(result.ranking).toHaveLength(6); // F8: sin pivote ni mediapunta
      expect(result.podium).toEqual(result.ranking.slice(0, 3).map((r) => r.pos));
      expect(result.winner).toBe(result.podium[0]);
      expect(result.suggestedKnowledgeExams).toEqual(result.podium);
      expect(res.body).not.toMatch(/prep/i);

      const items = await connection.db
        .select({ n: count() })
        .from(attemptItem)
        .where(eq(attemptItem.attemptId, result.attemptId));
      expect(items[0]!.n).toBe(20);
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

    it.each([
      [
        'faltan preguntas',
        (a: SubmitAttemptRequest) => ({ positionItems: a.positionItems.slice(1) }),
      ],
      [
        'una pregunta repetida',
        (a: SubmitAttemptRequest) => ({
          positionItems: a.positionItems.map((s, i) =>
            i === 1 ? { ...a.positionItems[0]!, shownOrder: 2 } : s,
          ),
        }),
      ],
      [
        'una respuesta que no es de la pregunta',
        (a: SubmitAttemptRequest) => ({
          positionItems: a.positionItems.map((s, i) =>
            i === 0 ? { ...s, answerOptionId: a.positionItems[1]!.answerOptionId } : s,
          ),
        }),
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
      expect(mine.items.length).toBeGreaterThanOrEqual(2);
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
