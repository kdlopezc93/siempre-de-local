import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { and, count, eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDb, type DbConnection } from '../../../../shared/db/client.js';
import { certBankFixture } from '../../../../test/cert-bank-fixture.js';
import { startMigratedPostgres } from '../../../../test/postgres.js';
import { certArea, certBankVersion, certItem, certOption } from '../schema.js';
import { publishCertBank } from './publish-cert-bank.js';

describe('publicar un banco del examen', () => {
  let container: StartedPostgreSqlContainer;
  let connection: DbConnection;

  beforeAll(async () => {
    container = await startMigratedPostgres();
    connection = createDb(container.getConnectionUri());
  });

  afterAll(async () => {
    await connection?.pool.end();
    await container?.stop();
  });

  it('sin revisión no se publica', async () => {
    await expect(
      publishCertBank(connection.db, certBankFixture(40, { review: null })),
    ).resolves.toBe('pending-review');
    expect(await connection.db.select().from(certBankVersion)).toEqual([]);
  });

  it('con errores de calidad falla y no deja nada a medias', async () => {
    await expect(publishCertBank(connection.db, certBankFixture(30))).rejects.toThrow(
      /se necesitan al menos 40/,
    );
    expect(await connection.db.select().from(certBankVersion)).toEqual([]);
  });

  it('publica completo, con quién lo revisó, y es idempotente', async () => {
    const { db } = connection;
    await expect(publishCertBank(db, certBankFixture(40))).resolves.toBe('published');
    await expect(publishCertBank(db, certBankFixture(40))).resolves.toBe('already-exists');

    const [version] = await db.select().from(certBankVersion);
    expect(version).toMatchObject({
      position: 'DFC',
      label: 'v1',
      status: 'published',
      itemsPerExam: 20,
      timeLimitS: 1200,
      attemptIntervalDays: 30,
      reviewedBy: 'Profe Revisor',
      reviewedOn: '2026-10-22',
      difficultyMix: { '1': 0.3, '2': 0.5, '3': 0.2 },
    });
    const n = async (table: typeof certItem | typeof certOption | typeof certArea) =>
      (await db.select({ n: count() }).from(table))[0]!.n;
    expect([await n(certArea), await n(certItem), await n(certOption)]).toEqual([3, 40, 160]);
    const [correct] = await db
      .select({ n: count() })
      .from(certOption)
      .where(eq(certOption.isCorrect, true));
    expect(correct!.n).toBe(40);
  });

  it('una versión nueva retira la anterior de esa posición', async () => {
    const { db } = connection;
    await publishCertBank(db, certBankFixture(45, { label: 'v2' }));
    const versions = await db
      .select({ label: certBankVersion.label, status: certBankVersion.status })
      .from(certBankVersion)
      .where(eq(certBankVersion.position, 'DFC'))
      .orderBy(certBankVersion.label);
    expect(versions).toEqual([
      { label: 'v1', status: 'retired' },
      { label: 'v2', status: 'published' },
    ]);
    // Las áreas son de la posición: no se duplican entre versiones.
    expect((await db.select().from(certArea)).length).toBe(3);
  });

  it('la base no admite dos correctas en un ítem', async () => {
    const { db } = connection;
    const [item] = await db.select({ id: certItem.id }).from(certItem).limit(1);
    await expect(
      db
        .insert(certOption)
        .values({ itemId: item!.id, label: 'Otra correcta', isCorrect: true, sort: 9 }),
    ).rejects.toThrow();
    const [stillOne] = await db
      .select({ n: count() })
      .from(certOption)
      .where(and(eq(certOption.itemId, item!.id), eq(certOption.isCorrect, true)));
    expect(stillOne!.n).toBe(1);
  });

  it('en desarrollo, un borrador se publica como "v1-borrador" y la versión revisada lo reemplaza', async () => {
    const { db } = connection;
    const draft = certBankFixture(40, { position: 'MC', review: null });
    await expect(publishCertBank(db, draft, { draftsForDevelopment: true })).resolves.toBe(
      'published',
    );
    await publishCertBank(db, { ...draft, review: { by: 'Profe', on: '2026-11-01' } });
    const versions = await db
      .select({
        label: certBankVersion.label,
        status: certBankVersion.status,
        reviewedBy: certBankVersion.reviewedBy,
      })
      .from(certBankVersion)
      .where(eq(certBankVersion.position, 'MC'))
      .orderBy(certBankVersion.label);
    expect(versions).toEqual([
      { label: 'v1', status: 'published', reviewedBy: 'Profe' },
      { label: 'v1-borrador', status: 'retired', reviewedBy: 'Sin revisar (solo desarrollo)' },
    ]);
  });

  it('corregir quién revisó una versión publicada actualiza solo ese dato', async () => {
    const { db } = connection;
    const bank = certBankFixture(45, { label: 'v2' });
    const before = (await db.select({ n: count() }).from(certItem))[0]!.n;
    await expect(
      publishCertBank(db, { ...bank, review: { by: 'Profe Ramírez', on: '2026-10-23' } }),
    ).resolves.toBe('review-updated');
    const [version] = await db
      .select({ reviewedBy: certBankVersion.reviewedBy, reviewedOn: certBankVersion.reviewedOn })
      .from(certBankVersion)
      .where(eq(certBankVersion.label, 'v2'));
    expect(version).toEqual({ reviewedBy: 'Profe Ramírez', reviewedOn: '2026-10-23' });
    // No se agregó ni se cambió ninguna pregunta.
    expect((await db.select({ n: count() }).from(certItem))[0]!.n).toBe(before);
  });
});
