import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import {
  AssessmentListResponseSchema,
  AssessmentResponseSchema,
  ErrorBodySchema,
  PlayerProfileResponseSchema,
  POLICY_VERSION,
  QuestionnaireResponseSchema,
  SquadResponseSchema,
} from '@sdl/contracts';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createDb, type DbConnection } from '../../../shared/db/client.js';
import { bootApp, TEST_ENV } from '../../../test/app.js';
import { startMigratedPostgres } from '../../../test/postgres.js';
import { seedUserWithSession, type SeededUser } from '../../../test/sessions.js';
import { ORIENTATION_V1 } from '../../questionnaires/infrastructure/seed/orientation-v1.content.js';
import { ORIENTATION_V2 } from '../../questionnaires/infrastructure/seed/orientation-v2.content.js';
import { seedOrientationContent } from '../../questionnaires/infrastructure/seed/seed-orientation.js';
import { bootstrapTeam } from '../../teams/infrastructure/bootstrap-team.js';
import { teamMembership } from '../../teams/infrastructure/schema.js';

describe('plantilla y valoraciones (a ciegas impuesto)', () => {
  let container: StartedPostgreSqlContainer;
  let connection: DbConnection;
  let app: NestFastifyApplication;
  let url: string;
  let owner: SeededUser, coach: SeededUser, assistant: SeededUser;
  let tested: SeededUser, untested: SeededUser, outsider: SeededUser;
  let teamId: string;

  const call = (method: 'GET' | 'POST', path: string, who: SeededUser, payload?: object) =>
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

  const consent = (who: SeededUser) =>
    call('POST', '/me/consent', who, { policyVersion: POLICY_VERSION, ageConfirmed: true });

  const squad = async (who: SeededUser) =>
    SquadResponseSchema.parse((await call('GET', `/teams/${teamId}/squad`, who)).json()).players;

  const assess = (who: SeededUser, playerId: string, primaryPosition = 'DFC') =>
    call('POST', `/teams/${teamId}/assessments`, who, {
      playerId,
      primaryPosition,
      secondaryPositions: ['LAT'],
      confidence: 4,
      notes: 'Ordena bien la línea',
    });

  beforeAll(async () => {
    container = await startMigratedPostgres();
    url = container.getConnectionUri();
    connection = createDb(url);
    await seedOrientationContent(connection.db, ORIENTATION_V1);
    await seedOrientationContent(connection.db, ORIENTATION_V2);
    const seed = (name: string) => seedUserWithSession(url, { name, email: `${name}@example.com` });
    [owner, coach, assistant, tested, untested, outsider] = [
      await seed('dueno'),
      await seed('profe'),
      await seed('asistente'),
      await seed('Ana Probada'),
      await seed('Beto Nuevo'),
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
      { teamId, userId: tested.userId, role: 'player' },
      { teamId, userId: untested.userId, role: 'player' },
    ]);
    app = await bootApp(url);
    for (const who of [owner, coach, assistant, tested, untested]) await consent(who);

    // Ana hace su test.
    const questionnaire = QuestionnaireResponseSchema.parse(
      (await call('GET', '/questionnaires/current', tested)).json(),
    );
    const items = questionnaire.positionItems.slice(0, questionnaire.positionItemsPerAttempt);
    const res = await call('POST', '/attempts', tested, {
      clientAttemptId: randomUUID(),
      teamId,
      questionnaireVersionId: questionnaire.versionId,
      format: 'F11',
      startedAt: new Date(Date.now() - 60_000).toISOString(),
      submittedAt: new Date().toISOString(),
      positionItems: items.map((item, i) => ({
        itemId: item.id,
        shownOrder: i + 1,
        optionOrder: item.options.map((o) => o.id),
        answerOptionId: item.options[0]!.id,
      })),
    });
    expect(res.statusCode).toBe(201);
  });

  afterAll(async () => {
    await app?.close();
    await connection?.pool.end();
    vi.unstubAllEnvs();
    await container?.stop();
  });

  it('quien valora no ve el test de un jugador hasta valorarlo', async () => {
    const before = await squad(coach);
    expect(before.map((p) => [p.displayName, p.test.status, p.assessedByMe])).toEqual([
      ['Ana Probada', 'hidden', false],
      ['Beto Nuevo', 'none', false],
    ]);
    expect(JSON.stringify(before)).not.toMatch(/podium/);
  });

  it('su primera valoración es a ciegas; después ve el test y las siguientes ya no lo son', async () => {
    const first = AssessmentResponseSchema.parse((await assess(coach, tested.userId)).json());
    expect(first.assessment).toMatchObject({
      blind: true,
      primaryPosition: 'DFC',
      secondaryPositions: ['LAT'],
      assessor: { id: coach.userId, name: 'profe' },
    });

    const ana = (await squad(coach)).find((p) => p.userId === tested.userId)!;
    expect(ana.test.status).toBe('visible');
    expect(ana.test.status === 'visible' && ana.test.podium).toHaveLength(3);
    expect(ana.assessedByMe).toBe(true);
    expect(ana.latestAssessment?.id).toBe(first.assessment.id);

    const second = AssessmentResponseSchema.parse(
      (await assess(coach, tested.userId, 'MCD')).json(),
    );
    expect(second.assessment.blind).toBe(false);
  });

  it('cada quien valora a ciegas por su cuenta: al asistente le sigue oculto', async () => {
    const ana = (await squad(assistant)).find((p) => p.userId === tested.userId)!;
    expect(ana.test.status).toBe('hidden');
    // Pero sí ve la última valoración del cuerpo técnico.
    expect(ana.latestAssessment?.primaryPosition).toBe('MCD');
  });

  it('el admin del club no valora y ve los resultados', async () => {
    const ana = (await squad(owner)).find((p) => p.userId === tested.userId)!;
    expect(ana.test.status).toBe('visible');
  });

  it('el historial de valoraciones: del más reciente al más antiguo, también por jugador', async () => {
    const list = AssessmentListResponseSchema.parse(
      (await call('GET', `/teams/${teamId}/assessments?playerId=${tested.userId}`, coach)).json(),
    );
    expect(list.items.map((a) => [a.primaryPosition, a.blind])).toEqual([
      ['MCD', false],
      ['DFC', true],
    ]);
  });

  it('jugadores y gente de fuera no ven la plantilla ni valoran', async () => {
    expect((await call('GET', `/teams/${teamId}/squad`, tested)).statusCode).toBe(403);
    expect((await call('GET', `/teams/${teamId}/assessments`, tested)).statusCode).toBe(403);
    expect((await assess(tested, untested.userId)).statusCode).toBe(403);
    expect((await call('GET', `/teams/${teamId}/squad`, outsider)).statusCode).toBe(403);
  });

  it('solo se valora a jugadores del equipo, con datos válidos', async () => {
    const res = await assess(coach, outsider.userId);
    expect(res.statusCode).toBe(404);
    expect(ErrorBodySchema.parse(res.json()).error.code).toBe('PLAYER_NOT_IN_TEAM');

    const bad = await call('POST', `/teams/${teamId}/assessments`, coach, {
      playerId: untested.userId,
      primaryPosition: 'DC',
      secondaryPositions: ['DC'],
      confidence: 6,
    });
    expect(bad.statusCode).toBe(400);
  });

  describe('perfil del jugador', () => {
    const profile = (who: SeededUser, playerId: string) =>
      call('GET', `/teams/${teamId}/players/${playerId}/profile`, who);

    it('junta perfil, test, valoraciones y tarjeta; el test sigue la regla a ciegas', async () => {
      // El asistente aún no valoró a Ana: ve sus datos y valoraciones, pero no su test.
      const hidden = PlayerProfileResponseSchema.parse(
        (await profile(assistant, tested.userId)).json(),
      );
      expect(hidden.player).toMatchObject({ userId: tested.userId, displayName: 'Ana Probada' });
      expect(hidden.test).toEqual({ status: 'hidden' });
      expect(hidden.assessments.map((a) => a.primaryPosition)).toEqual(['MCD', 'DFC']);
      expect(hidden.assessedByMe).toBe(false);
      expect(JSON.stringify(hidden)).not.toMatch(/podium|ranking/);

      await call('POST', `/teams/${teamId}/players/${tested.userId}/ratings`, coach, {
        values: { PAC: 80, SHO: 60, PAS: 70, DRI: 75, DEF: 40, PHY: 65 },
      });
      const seen = PlayerProfileResponseSchema.parse((await profile(coach, tested.userId)).json());
      expect(seen.test.status).toBe('visible');
      if (seen.test.status === 'visible') {
        expect(seen.test.ranking).toHaveLength(8);
        expect(seen.test.ranking.slice(0, 3).map((r) => r.pos)).toEqual(seen.test.podium);
      }
      expect(seen.card?.positionAverages.EXT).toBe(74);
      expect(seen.cardCount).toBe(1);
    });

    it('sin test ni tarjeta, lo dice; fuera del equipo, 404; jugadores y de afuera, 403', async () => {
      const beto = PlayerProfileResponseSchema.parse(
        (await profile(owner, untested.userId)).json(),
      );
      expect(beto).toMatchObject({ test: { status: 'none' }, card: null, cardCount: 0 });

      const res = await profile(coach, outsider.userId);
      expect(res.statusCode).toBe(404);
      expect(ErrorBodySchema.parse(res.json()).error.code).toBe('PLAYER_NOT_IN_TEAM');
      expect((await profile(tested, tested.userId)).statusCode).toBe(403);
      expect((await profile(outsider, tested.userId)).statusCode).toBe(403);
    });
  });
});
