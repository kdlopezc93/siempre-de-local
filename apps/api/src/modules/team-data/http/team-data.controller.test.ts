import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import {
  LegacyImportResponseSchema,
  LegacyResultListResponseSchema,
  POLICY_VERSION,
  QuestionnaireResponseSchema,
} from '@sdl/contracts';
import { eq } from 'drizzle-orm';
import { randomUUID } from 'node:crypto';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createDb, type DbConnection } from '../../../shared/db/client.js';
import { bootApp, TEST_ENV } from '../../../test/app.js';
import { startMigratedPostgres } from '../../../test/postgres.js';
import { seedUserWithSession, type SeededUser } from '../../../test/sessions.js';
import { auditLog } from '../../audit/infrastructure/schema.js';
import { ORIENTATION_V1 } from '../../questionnaires/infrastructure/seed/orientation-v1.content.js';
import { ORIENTATION_V2 } from '../../questionnaires/infrastructure/seed/orientation-v2.content.js';
import { seedOrientationContent } from '../../questionnaires/infrastructure/seed/seed-orientation.js';
import { bootstrapTeam } from '../../teams/infrastructure/bootstrap-team.js';
import { teamMembership } from '../../teams/infrastructure/schema.js';

const BOM = String.fromCharCode(0xfeff);
/** Como lo descarga el detector del prototipo. */
const PROTOTYPE_CSV = `${BOM}"Nombre","Fecha","Formato","Posicion","Afinidad_%","Podio","Preparacion","Preparacion_%"
"ana probada","2026-05-10 14:32","Fútbol F11","Mediocentro","88","Mediocentro (88%) | Pivote (75%) | Mediapunta (70%)","7/8","88"
"Carlos Viejo","2026-05-11 09:00","Fútbol F11","Lateral","70","Lateral (70%) | Extremo (60%) | Defensa central (55%)","5/8","63"
"Sin Posición","2026-05-11 09:00","Fútbol F11","Volante","70","","",""`;

describe('datos del equipo: exportar e importar', () => {
  let container: StartedPostgreSqlContainer;
  let connection: DbConnection;
  let app: NestFastifyApplication;
  let owner: SeededUser, coach: SeededUser, assistant: SeededUser;
  let ana: SeededUser, beto: SeededUser;
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

  /** Filas del CSV exportado, sin BOM, como matriz. */
  const exported = async (who: SeededUser) => {
    const res = await call('GET', `/teams/${teamId}/export.csv`, who);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toContain('text/csv');
    expect(res.headers['content-disposition']).toMatch(
      /^attachment; filename="plantilla-primer-equipo-\d{4}-\d{2}-\d{2}\.csv"$/,
    );
    expect(res.body.startsWith(BOM)).toBe(true);
    return res.body
      .slice(1)
      .trim()
      .split('\r\n')
      .map((line) => line.slice(1, -1).split('","'));
  };

  beforeAll(async () => {
    container = await startMigratedPostgres();
    const url = container.getConnectionUri();
    connection = createDb(url);
    await seedOrientationContent(connection.db, ORIENTATION_V1);
    await seedOrientationContent(connection.db, ORIENTATION_V2);
    const seed = (name: string) => seedUserWithSession(url, { name, email: `${name}@example.com` });
    [owner, coach, assistant, ana, beto] = [
      await seed('dueno'),
      await seed('profe'),
      await seed('asistente'),
      await seed('Ana Probada'),
      await seed('Beto'),
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
      { teamId, userId: ana.userId, role: 'player', jerseyNumber: 8 },
      { teamId, userId: beto.userId, role: 'player' },
    ]);
    app = await bootApp(url);
    for (const who of [owner, coach, assistant, ana, beto]) {
      await call('POST', '/me/consent', who, { policyVersion: POLICY_VERSION, ageConfirmed: true });
    }
    // Beto se pone un nombre que Excel tomaría por fórmula.
    await call('PATCH', '/me/profile', beto, { displayName: '=HYPERLINK("http://x")' });

    const questionnaire = QuestionnaireResponseSchema.parse(
      (await call('GET', '/questionnaires/current', ana)).json(),
    );
    const items = questionnaire.positionItems.slice(0, questionnaire.positionItemsPerAttempt);
    const res = await call('POST', '/attempts', ana, {
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
    await call('POST', `/teams/${teamId}/players/${ana.userId}/ratings`, coach, {
      values: { PAC: 80, SHO: 60, PAS: 70, DRI: 75, DEF: 40, PHY: 65 },
      notes: 'Nota privada',
    });
  });

  afterAll(async () => {
    await app?.close();
    await connection?.pool.end();
    vi.unstubAllEnvs();
    await container?.stop();
  });

  it('exporta una fila por jugador, respetando la regla a ciegas y sin notas', async () => {
    const [header, ...rows] = await exported(coach);
    expect(header!.slice(0, 5)).toEqual([
      'Nombre',
      'Dorsal',
      'Preferidas',
      'Test_fecha',
      'Test_podio',
    ]);
    expect(header).toContain('RIT');
    expect(header).toContain('Media_EXT');
    const anaRow = rows.find((r) => r[0] === 'Ana Probada')!;
    // El coach no la valoró: su test no sale.
    expect(anaRow[4]).toBe('Oculto hasta que lo valores');
    expect(anaRow[1]).toBe('8');
    expect(anaRow[header!.indexOf('RIT')]).toBe('80');
    expect(anaRow[header!.indexOf('Media_EXT')]).toBe('74');
    expect(rows.flat().join()).not.toMatch(/Nota privada/);

    // El admin del club no valora: ve el podio.
    const [, ...ownerRows] = await exported(owner);
    expect(ownerRows.find((r) => r[0] === 'Ana Probada')![4]).toMatch(/ \| .* \| /);
  });

  it('un nombre con forma de fórmula sale neutralizado', async () => {
    const [, ...rows] = await exported(coach);
    expect(rows.map((r) => r[0])).toContain(`'=HYPERLINK(""http://x"")`);
  });

  it('el asistente y los jugadores no exportan ni importan', async () => {
    for (const who of [assistant, ana]) {
      expect((await call('GET', `/teams/${teamId}/export.csv`, who)).statusCode).toBe(403);
      expect(
        (await call('POST', `/teams/${teamId}/legacy-import`, who, { csv: PROTOTYPE_CSV }))
          .statusCode,
      ).toBe(403);
    }
  });

  it('importa los CSV del prototipo, liga por nombre y no repite', async () => {
    const first = LegacyImportResponseSchema.parse(
      (await call('POST', `/teams/${teamId}/legacy-import`, coach, { csv: PROTOTYPE_CSV })).json(),
    );
    expect(first).toEqual({
      imported: 2,
      duplicates: 0,
      linked: 1,
      rejected: [{ line: 4, reason: 'Posición desconocida: "Volante"' }],
    });

    const again = LegacyImportResponseSchema.parse(
      (await call('POST', `/teams/${teamId}/legacy-import`, owner, { csv: PROTOTYPE_CSV })).json(),
    );
    expect(again).toMatchObject({ imported: 0, duplicates: 2 });

    const { items } = LegacyResultListResponseSchema.parse(
      (await call('GET', `/teams/${teamId}/legacy-results`, coach)).json(),
    );
    expect(items.map((r) => [r.playerName, r.player?.userId ?? null, r.winner, r.takenAt])).toEqual(
      [
        ['ana probada', ana.userId, 'MC', '2026-05-10T14:32'],
        ['Carlos Viejo', null, 'LAT', '2026-05-11T09:00'],
      ],
    );
    expect(items[0]).toMatchObject({ podium: ['MC', 'MCD', 'MP'], prepScore: 7, prepTotal: 8 });
  });

  it('exportar, importar, puntuar y cambiar ajustes quedan en audit_log', async () => {
    await call('PATCH', `/teams/${teamId}`, coach, { ratingsVisibleToPlayers: false });
    const rows = await connection.db.select().from(auditLog).where(eq(auditLog.teamId, teamId));
    const actions = rows.map((r) => r.action);
    expect(actions).toEqual(
      expect.arrayContaining([
        'rating.created',
        'team.exported',
        'team.legacy_imported',
        'team.settings_updated',
      ]),
    );
    const exportRow = rows.find(
      (r) => r.action === 'team.exported' && r.actorUserId === coach.userId,
    );
    expect(exportRow?.meta).toEqual({ format: 'csv', players: 2 });
  });

  it('un CSV vacío o enorme se rechaza antes de leerlo', async () => {
    expect(
      (await call('POST', `/teams/${teamId}/legacy-import`, coach, { csv: '' })).statusCode,
    ).toBe(400);
    expect(
      (await call('POST', `/teams/${teamId}/legacy-import`, coach, { csv: 'x'.repeat(512_001) }))
        .statusCode,
    ).toBe(400);
  });
});
