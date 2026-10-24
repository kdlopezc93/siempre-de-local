import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import {
  CertPositionsResponseSchema,
  ErrorBodySchema,
  ExamInProgressSchema,
  ExamResponseSchema,
  ExamResultSchema,
  MyExamsResponseSchema,
  POLICY_VERSION,
} from '@sdl/contracts';
import { eq, sql } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createDb, type DbConnection } from '../../../shared/db/client.js';
import { bootApp, TEST_ENV } from '../../../test/app.js';
import { certBankFixture } from '../../../test/cert-bank-fixture.js';
import { startMigratedPostgres } from '../../../test/postgres.js';
import { seedUserWithSession, type SeededUser } from '../../../test/sessions.js';
import { certExam, certOption } from '../infrastructure/schema.js';
import { publishCertBank } from '../infrastructure/seed/publish-cert-bank.js';

describe('examen de conocimiento', () => {
  let container: StartedPostgreSqlContainer;
  let connection: DbConnection;
  let app: NestFastifyApplication;
  let ana: SeededUser, beto: SeededUser, caro: SeededUser, sinConsentimiento: SeededUser;

  const call = (method: 'GET' | 'POST' | 'PUT', path: string, who: SeededUser, payload?: object) =>
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

  const start = (who: SeededUser, position = 'DFC') =>
    call('POST', '/cert-exams', who, { position });

  /** Las correctas, leídas de la base (el API nunca las manda). */
  const correctOf = async (optionIds: string[]) => {
    const rows = await connection.db
      .select({ id: certOption.id })
      .from(certOption)
      .where(sql`${certOption.id} in ${optionIds} and ${certOption.isCorrect}`);
    return new Set(rows.map((r) => r.id));
  };

  beforeAll(async () => {
    container = await startMigratedPostgres();
    const url = container.getConnectionUri();
    connection = createDb(url);
    await publishCertBank(connection.db, certBankFixture(40));
    const seed = (name: string) => seedUserWithSession(url, { name, email: `${name}@example.com` });
    [ana, beto, caro, sinConsentimiento] = [
      await seed('ana'),
      await seed('beto'),
      await seed('caro'),
      await seed('dani'),
    ];
    app = await bootApp(url);
    for (const who of [ana, beto, caro]) {
      await call('POST', '/me/consent', who, { policyVersion: POLICY_VERSION, ageConfirmed: true });
    }
  });

  afterAll(async () => {
    await app?.close();
    await connection?.pool.end();
    vi.unstubAllEnvs();
    await container?.stop();
  });

  it('lista las posiciones con banco publicado', async () => {
    const { positions } = CertPositionsResponseSchema.parse(
      (await call('GET', '/certification/positions', ana)).json(),
    );
    expect(positions).toEqual([
      {
        position: 'DFC',
        bank: {
          label: 'v1',
          itemsPerExam: 20,
          timeLimitSeconds: 1200,
          attemptIntervalDays: 30,
          areas: [
            { code: 'marcaje', name: 'Marcaje' },
            { code: 'linea', name: 'Línea defensiva y fuera de juego' },
            { code: 'aereo', name: 'Juego aéreo' },
          ],
        },
        best: null,
        review: null,
        nextAttemptAt: null,
        activeExamId: null,
      },
    ]);
  });

  it('del inicio al resultado: 20 preguntas sin correctas, respuestas una a una y puntaje por área', async () => {
    const res = await start(ana);
    expect(res.statusCode).toBe(201);
    const exam = ExamInProgressSchema.parse(res.json());
    expect(exam.items).toHaveLength(20);
    expect(new Set(exam.items.map((i) => i.area.code))).toEqual(
      new Set(['marcaje', 'linea', 'aereo']),
    );
    expect(Date.parse(exam.deadlineAt) - Date.parse(exam.startedAt)).toBe(1200_000);
    // Nada que delate la respuesta.
    const keys = JSON.stringify(res.json())
      .match(/"[a-zA-Z]+":/g)!
      .map((k) => k.slice(1, -2));
    expect(keys).not.toContain('correct');
    expect(keys).not.toContain('isCorrect');
    expect(keys).not.toContain('explanation');

    // Un examen activo a la vez.
    const again = await start(ana);
    expect(again.statusCode).toBe(409);
    expect(ErrorBodySchema.parse(again.json()).error).toMatchObject({
      code: 'EXAM_IN_PROGRESS',
      details: { examId: exam.examId },
    });

    // Responde bien las primeras 15 y mal las 5 últimas.
    const correct = await correctOf(exam.items.flatMap((i) => i.options.map((o) => o.id)));
    for (const [i, item] of exam.items.entries()) {
      const right = item.options.find((o) => correct.has(o.id))!;
      const wrong = item.options.find((o) => !correct.has(o.id))!;
      const put = await call('PUT', `/cert-exams/${exam.examId}/answers/${item.id}`, ana, {
        optionId: (i < 15 ? right : wrong).id,
      });
      expect(put.statusCode).toBe(204);
    }
    // Una opción de otra pregunta no vale.
    const bad = await call('PUT', `/cert-exams/${exam.examId}/answers/${exam.items[0]!.id}`, ana, {
      optionId: exam.items[1]!.options[0]!.id,
    });
    expect(ErrorBodySchema.parse(bad.json()).error.code).toBe('ANSWER_INVALID');
    // El examen de otro no existe para ti.
    expect((await call('GET', `/cert-exams/${exam.examId}`, beto)).statusCode).toBe(404);

    // Al recargar, vuelven las respuestas dadas.
    const resumed = ExamResponseSchema.parse(
      (await call('GET', `/cert-exams/${exam.examId}`, ana)).json(),
    );
    expect(resumed.state === 'in_progress' && resumed.items.every((i) => i.answerOptionId)).toBe(
      true,
    );

    const result = ExamResultSchema.parse(
      (await call('POST', `/cert-exams/${exam.examId}/submit`, ana)).json(),
    );
    expect(result).toMatchObject({
      endedBy: 'submit',
      score: 15,
      total: 20,
      pct: 0.75,
      band: 'solid',
    });
    expect(result.byArea.reduce((n, a) => n + a.total, 0)).toBe(20);
    expect(result.byArea[0]!.area.name).toEqual(expect.any(String));
    expect(Date.parse(result.nextAttemptAt) - Date.parse(result.startedAt)).toBe(30 * 86_400_000);

    // Entregar otra vez devuelve lo mismo.
    const twice = ExamResultSchema.parse(
      (await call('POST', `/cert-exams/${exam.examId}/submit`, ana)).json(),
    );
    expect(twice.score).toBe(15);
  });

  it('cuenta el mejor y pide esperar el mes para repetir', async () => {
    const { positions } = CertPositionsResponseSchema.parse(
      (await call('GET', '/certification/positions', ana)).json(),
    );
    expect(positions[0]).toMatchObject({ best: { pct: 0.75, band: 'solid' }, activeExamId: null });
    expect(positions[0]!.nextAttemptAt).not.toBeNull();

    const res = await start(ana);
    expect(res.statusCode).toBe(422);
    expect(ErrorBodySchema.parse(res.json()).error).toMatchObject({
      code: 'ATTEMPT_INTERVAL',
      details: { nextAttemptAt: positions[0]!.nextAttemptAt },
    });

    const { items } = MyExamsResponseSchema.parse(
      (await call('GET', '/me/cert-exams', ana)).json(),
    );
    expect(items.map((e) => e.score)).toEqual([15]);
  });

  it('si se acaba el tiempo se cierra con lo respondido y no acepta más', async () => {
    const exam = ExamInProgressSchema.parse((await start(beto)).json());
    const first = exam.items[0]!;
    await call('PUT', `/cert-exams/${exam.examId}/answers/${first.id}`, beto, {
      optionId: first.options[0]!.id,
    });
    await connection.db
      .update(certExam)
      .set({ deadlineAt: new Date(Date.now() - 60_000) })
      .where(eq(certExam.id, exam.examId));

    const late = await call(
      'PUT',
      `/cert-exams/${exam.examId}/answers/${exam.items[1]!.id}`,
      beto,
      {
        optionId: exam.items[1]!.options[0]!.id,
      },
    );
    expect(ErrorBodySchema.parse(late.json()).error.code).toBe('EXAM_DEADLINE_PASSED');
    const closed = ExamResponseSchema.parse(
      (await call('GET', `/cert-exams/${exam.examId}`, beto)).json(),
    );
    expect(closed).toMatchObject({ state: 'finished', endedBy: 'timeout', total: 20 });
    expect(closed.state === 'finished' && closed.score).toBeLessThanOrEqual(1);
  });

  it('abandonar puntúa lo respondido y consume el mes', async () => {
    const exam = ExamInProgressSchema.parse((await start(caro)).json());
    const result = ExamResultSchema.parse(
      (await call('POST', `/cert-exams/${exam.examId}/abandon`, caro)).json(),
    );
    expect(result).toMatchObject({ endedBy: 'abandon', score: 0, band: 'insufficient' });
    expect((await start(caro)).statusCode).toBe(422);
  });

  it('pizarra (Fase 8): la jugada sin los puntos; cada opción barajada trae el suyo', async () => {
    const SPOTS = [
      { x: 20, y: 110 },
      { x: 45, y: 100 },
      { x: 75, y: 112 },
      { x: 50, y: 138 },
    ];
    const bank = certBankFixture(40, { position: 'LAT' });
    const withBoards = {
      ...bank,
      items: bank.items.map((item) => ({
        ...item,
        board: {
          view: 'own-half' as const,
          pieces: [{ side: 'rival' as const, x: 60, y: 95, label: '9' }],
          ball: { x: 30, y: 90 },
          spots: SPOTS,
        },
      })),
    };
    await publishCertBank(connection.db, withBoards);
    const exam = ExamInProgressSchema.parse((await start(ana, 'LAT')).json());
    const authored = new Map(
      withBoards.items.flatMap((item) => item.options.map((o, i) => [o.label, SPOTS[i]])),
    );
    for (const item of exam.items) {
      expect(item.board).toEqual({
        view: 'own-half',
        pieces: [{ side: 'rival', x: 60, y: 95, label: '9' }],
        ball: { x: 30, y: 90 },
      });
      for (const option of item.options) expect(option.spot).toEqual(authored.get(option.label));
    }
    // Ninguna clave delata la correcta ni el orden en que se escribieron las opciones.
    expect(JSON.stringify(exam)).not.toMatch(/"(spots|correct\w*|isCorrect)":/i);
  });

  it('sin banco publicado, sin consentimiento o desde un equipo ajeno no se empieza', async () => {
    expect(ErrorBodySchema.parse((await start(caro, 'MC')).json()).error.code).toBe(
      'NO_PUBLISHED_BANK',
    );
    expect(ErrorBodySchema.parse((await start(sinConsentimiento)).json()).error.code).toBe(
      'CONSENT_REQUIRED',
    );
    const res = await call('POST', '/cert-exams', beto, {
      position: 'DFC',
      teamId: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f70',
    });
    expect(res.statusCode).toBe(403);
  });

  it('con una sola de pizarra en el banco, el examen la trae (02 §6.3)', async () => {
    const bank = certBankFixture(40, { position: 'EXT' });
    const [first, ...rest] = bank.items;
    const board = {
      view: 'full' as const,
      pieces: [{ side: 'own' as const, x: 50, y: 75, label: '7' }],
      spots: [
        { x: 20, y: 40 },
        { x: 45, y: 40 },
        { x: 70, y: 40 },
        { x: 50, y: 110 },
      ],
    };
    await publishCertBank(connection.db, { ...bank, items: [{ ...first!, board }, ...rest] });
    const exam = ExamInProgressSchema.parse((await start(caro, 'EXT')).json());
    expect(exam.items.filter((item) => item.board)).toHaveLength(1);
  });
});
