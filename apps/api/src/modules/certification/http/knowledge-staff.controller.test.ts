import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import {
  CertPositionsResponseSchema,
  ErrorBodySchema,
  ExamInProgressSchema,
  ExamResultSchema,
  KnowledgeReviewResponseSchema,
  MyExamsResponseSchema,
  PlayerProfileResponseSchema,
  POLICY_VERSION,
  SquadResponseSchema,
} from '@sdl/contracts';
import { and, eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createDb, type DbConnection } from '../../../shared/db/client.js';
import { bootApp, TEST_ENV } from '../../../test/app.js';
import { certBankFixture } from '../../../test/cert-bank-fixture.js';
import { startMigratedPostgres } from '../../../test/postgres.js';
import { seedUserWithSession, type SeededUser } from '../../../test/sessions.js';
import { auditLog } from '../../audit/infrastructure/schema.js';
import { bootstrapTeam } from '../../teams/infrastructure/bootstrap-team.js';
import { teamMembership } from '../../teams/infrastructure/schema.js';
import { certExam, certOption, certReviewRequest } from '../infrastructure/schema.js';
import { publishCertBank } from '../infrastructure/seed/publish-cert-bank.js';

describe('conocimiento: anular y re-evaluar (cuerpo técnico)', () => {
  let container: StartedPostgreSqlContainer;
  let connection: DbConnection;
  let app: NestFastifyApplication;
  let owner: SeededUser, coach: SeededUser, assistant: SeededUser, ana: SeededUser;
  let outsider: SeededUser;
  let teamId: string;

  const call = (
    method: 'GET' | 'POST' | 'PUT' | 'DELETE',
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

  /** Ana presenta DFC y acierta `right` de 20. */
  const takeExam = async (right: number) => {
    const res = await call('POST', '/cert-exams', ana, { position: 'DFC', teamId });
    expect(res.statusCode).toBe(201);
    const exam = ExamInProgressSchema.parse(res.json());
    const correct = new Set(
      (
        await connection.db
          .select({ id: certOption.id })
          .from(certOption)
          .where(
            sql`${certOption.id} in ${exam.items.flatMap((i) => i.options.map((o) => o.id))} and ${certOption.isCorrect}`,
          )
      ).map((r) => r.id),
    );
    for (const [i, item] of exam.items.entries()) {
      const option = item.options.find((o) => correct.has(o.id) === i < right)!;
      await call('PUT', `/cert-exams/${exam.examId}/answers/${item.id}`, ana, {
        optionId: option.id,
      });
    }
    return ExamResultSchema.parse(
      (await call('POST', `/cert-exams/${exam.examId}/submit`, ana)).json(),
    );
  };

  const profile = async (who: SeededUser = coach) =>
    PlayerProfileResponseSchema.parse(
      (await call('GET', `/teams/${teamId}/players/${ana.userId}/profile`, who)).json(),
    ).knowledge;

  beforeAll(async () => {
    container = await startMigratedPostgres();
    const url = container.getConnectionUri();
    connection = createDb(url);
    await publishCertBank(connection.db, certBankFixture(40));
    const seed = (name: string) => seedUserWithSession(url, { name, email: `${name}@example.com` });
    [owner, coach, assistant, ana, outsider] = [
      await seed('dueno'),
      await seed('profe'),
      await seed('asistente'),
      await seed('ana'),
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
      { teamId, userId: ana.userId, role: 'player' },
    ]);
    app = await bootApp(url);
    for (const who of [owner, coach, assistant, ana]) {
      await call('POST', '/me/consent', who, { policyVersion: POLICY_VERSION, ageConfirmed: true });
    }
  });

  afterAll(async () => {
    await app?.close();
    await connection?.pool.end();
    vi.unstubAllEnvs();
    await container?.stop();
  });

  it('el cuerpo técnico ve el conocimiento en el perfil y la plantilla', async () => {
    const first = await takeExam(16);
    expect(first.pct).toBe(0.8);
    const knowledge = await profile();
    expect(knowledge.positions).toEqual([
      { position: 'DFC', best: expect.objectContaining({ pct: 0.8, band: 'solid' }), review: null },
    ]);
    expect(knowledge.exams.map((e) => e.score)).toEqual([16]);
    const { players } = SquadResponseSchema.parse(
      (await call('GET', `/teams/${teamId}/squad`, assistant)).json(),
    );
    expect(players[0]!.knowledge).toEqual([
      { position: 'DFC', pct: 0.8, band: 'solid', review: null },
    ]);
  });

  it('anular: motivo obligatorio, deja de contar, el jugador ve por qué y puede repetir si se permite', async () => {
    const [exam] = (await profile()).exams;
    const voidIt = (who: SeededUser, payload: object) =>
      call('POST', `/teams/${teamId}/cert-exams/${exam!.examId}/void`, who, payload);

    expect((await voidIt(coach, { reason: 'x' })).statusCode).toBe(400);
    expect((await voidIt(assistant, { reason: 'Lo hizo otra persona' })).statusCode).toBe(403);
    expect(
      (await voidIt(coach, { reason: 'Lo hizo otra persona', resetInterval: true })).statusCode,
    ).toBe(204);
    expect(
      ErrorBodySchema.parse((await voidIt(owner, { reason: 'Otra vez' })).json()).error.code,
    ).toBe('EXAM_ALREADY_VOID');

    expect((await profile()).positions[0]!.best).toBeNull();
    const { items } = MyExamsResponseSchema.parse(
      (await call('GET', '/me/cert-exams', ana)).json(),
    );
    expect(items[0]!.voided).toMatchObject({ reason: 'Lo hizo otra persona' });
    // Con reinicio: puede presentar de nuevo sin esperar el mes.
    const { positions } = CertPositionsResponseSchema.parse(
      (await call('GET', '/certification/positions', ana)).json(),
    );
    expect(positions[0]!.nextAttemptAt).toBeNull();
  });

  it('re-evaluación: salta la espera y su resultado reemplaza al anterior aunque sea más bajo', async () => {
    const good = await takeExam(18);
    expect(good.pct).toBe(0.9);
    // Este mes ya no puede presentar…
    expect((await call('POST', '/cert-exams', ana, { position: 'DFC' })).statusCode).toBe(422);

    const res = await call(
      'POST',
      `/teams/${teamId}/players/${ana.userId}/knowledge-reviews`,
      coach,
      {
        position: 'DFC',
        reason: 'En la cancha no está aplicando lo que sabe',
      },
    );
    expect(res.statusCode).toBe(201);
    const { review } = KnowledgeReviewResponseSchema.parse(res.json());
    expect(Date.parse(review.dueAt) - Date.parse(review.requestedAt)).toBe(14 * 86_400_000);
    // Una abierta por jugador y posición.
    const dup = await call(
      'POST',
      `/teams/${teamId}/players/${ana.userId}/knowledge-reviews`,
      coach,
      {
        position: 'DFC',
        reason: 'Otra vez lo mismo',
      },
    );
    expect(ErrorBodySchema.parse(dup.json()).error.code).toBe('REVIEW_ALREADY_OPEN');

    // El jugador la ve con el motivo y puede presentar ya.
    const { positions } = CertPositionsResponseSchema.parse(
      (await call('GET', '/certification/positions', ana)).json(),
    );
    expect(positions[0]).toMatchObject({
      review: { reason: 'En la cancha no está aplicando lo que sabe', status: 'pending' },
      nextAttemptAt: null,
    });
    expect((await profile()).positions[0]!.review?.status).toBe('pending');

    const redo = await takeExam(10);
    expect(redo).toMatchObject({ pct: 0.5, fromReview: true });
    const knowledge = await profile();
    // Cuenta el 50% aunque antes tuvo 90%: el anterior quedó sustituido.
    expect(knowledge.positions[0]).toMatchObject({ best: { pct: 0.5 }, review: null });
    expect(knowledge.exams.find((e) => e.pct === 0.9)?.superseded).toBe(true);
    const [stored] = await connection.db
      .select({ status: certReviewRequest.status, resolved: certReviewRequest.resolvedExamId })
      .from(certReviewRequest)
      .where(eq(certReviewRequest.id, review.id));
    expect(stored).toEqual({ status: 'completed', resolved: redo.examId });
  });

  it('vencida sigue abierta y se puede cancelar', async () => {
    const { review } = KnowledgeReviewResponseSchema.parse(
      (
        await call('POST', `/teams/${teamId}/players/${ana.userId}/knowledge-reviews`, owner, {
          position: 'DFC',
          reason: 'Queremos ver si mejoró',
          dueInDays: 3,
        })
      ).json(),
    );
    await connection.db
      .update(certReviewRequest)
      .set({ dueAt: new Date(Date.now() - 60_000) })
      .where(eq(certReviewRequest.id, review.id));
    const { players } = SquadResponseSchema.parse(
      (await call('GET', `/teams/${teamId}/squad`, coach)).json(),
    );
    expect(players[0]!.knowledge[0]!.review).toBe('expired');
    expect((await profile()).positions[0]!.review?.status).toBe('expired');

    expect(
      (await call('DELETE', `/teams/${teamId}/knowledge-reviews/${review.id}`, assistant))
        .statusCode,
    ).toBe(403);
    expect(
      (await call('DELETE', `/teams/${teamId}/knowledge-reviews/${review.id}`, coach)).statusCode,
    ).toBe(204);
    expect((await profile()).positions[0]!.review).toBeNull();
  });

  it('fuera del equipo no se anula ni se re-evalúa; todo queda auditado', async () => {
    const [exam] = await connection.db
      .select({ id: certExam.id })
      .from(certExam)
      .where(and(eq(certExam.userId, ana.userId), eq(certExam.status, 'submitted')))
      .limit(1);
    expect(
      (
        await call('POST', `/teams/${teamId}/cert-exams/${exam!.id}/void`, outsider, {
          reason: 'Porque sí',
        })
      ).statusCode,
    ).toBe(403);
    const res = await call(
      'POST',
      `/teams/${teamId}/players/${outsider.userId}/knowledge-reviews`,
      coach,
      { position: 'DFC', reason: 'No juega aquí' },
    );
    expect(ErrorBodySchema.parse(res.json()).error.code).toBe('PLAYER_NOT_IN_TEAM');
    const noBank = await call(
      'POST',
      `/teams/${teamId}/players/${ana.userId}/knowledge-reviews`,
      coach,
      {
        position: 'MC',
        reason: 'Todavía no hay banco',
      },
    );
    expect(ErrorBodySchema.parse(noBank.json()).error.code).toBe('NO_PUBLISHED_BANK');

    const actions = (
      await connection.db
        .select({ action: auditLog.action })
        .from(auditLog)
        .where(eq(auditLog.teamId, teamId))
    ).map((r) => r.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'cert_exam.voided',
        'cert_review.requested',
        'cert_review.cancelled',
      ]),
    );
  });

  it('anular el examen de una re-evaluación: lo reemplazado vuelve a contar y la re-evaluación se reabre', async () => {
    // Estado tras la re-evaluación: cuenta el 50% y el 90% quedó reemplazado.
    const before = await profile();
    const review = before.exams.find((e) => e.fromReview && !e.voided)!;
    expect(before.positions[0]!.best?.pct).toBe(0.5);

    const res = await call('POST', `/teams/${teamId}/cert-exams/${review.examId}/void`, coach, {
      reason: 'Lo hizo otra persona',
      resetInterval: true,
    });
    expect(res.statusCode).toBe(204);

    const after = await profile();
    expect(after.positions[0]!.best?.pct).toBe(0.9);
    expect(after.exams.find((e) => e.pct === 0.9)?.superseded).toBe(false);
    expect(after.positions[0]!.review).toMatchObject({ status: 'pending', resolvedExamId: null });
    // El jugador puede presentarla ya.
    const { positions } = CertPositionsResponseSchema.parse(
      (await call('GET', '/certification/positions', ana)).json(),
    );
    expect(positions[0]).toMatchObject({ nextAttemptAt: null, review: { status: 'pending' } });
  });
});
