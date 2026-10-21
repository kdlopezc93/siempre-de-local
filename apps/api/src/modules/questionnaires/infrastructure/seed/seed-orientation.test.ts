import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { count, eq, sql } from 'drizzle-orm';
import type { PgTable } from 'drizzle-orm/pg-core';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';

import { createDb, type DbConnection } from '../../../../shared/db/client.js';
import { startMigratedPostgres } from '../../../../test/postgres.js';
import {
  optionWeight,
  positionItem,
  positionOption,
  prepItem,
  prepOption,
  questionnaireVersion,
} from '../schema.js';
import { ORIENTATION_V1 } from './orientation-v1.content.js';
import { seedOrientationContent } from './seed-orientation.js';

describe('seed del cuestionario v1', () => {
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

  it('publica v1 completa y es idempotente', async () => {
    const { db } = connection;
    await expect(seedOrientationContent(db, ORIENTATION_V1)).resolves.toBe('created');
    await expect(seedOrientationContent(db, ORIENTATION_V1)).resolves.toBe('already-exists');

    const [version] = await db.select().from(questionnaireVersion);
    expect(version).toMatchObject({
      label: 'v1',
      status: 'published',
      positionItemsPerAttempt: 15,
    });

    const rows = async (table: PgTable) => (await db.select({ n: count() }).from(table))[0]!.n;
    expect(await rows(positionItem)).toBe(31);
    expect(await rows(positionOption)).toBe(124);
    expect(await rows(prepItem)).toBe(64);
    expect(await rows(prepOption)).toBe(256);
    const [correct] = await db
      .select({ n: count() })
      .from(prepOption)
      .where(eq(prepOption.isCorrect, true));
    expect(correct!.n).toBe(64);

    // Los puntos guardados de p1 son los del prototipo.
    const p1 = await db
      .select({
        sort: positionOption.sort,
        position: optionWeight.position,
        points: optionWeight.points,
      })
      .from(optionWeight)
      .innerJoin(positionOption, eq(optionWeight.optionId, positionOption.id))
      .innerJoin(positionItem, eq(positionOption.itemId, positionItem.id))
      .where(eq(positionItem.code, 'p1'))
      .orderBy(positionOption.sort, optionWeight.position);
    expect(p1.filter((w) => w.sort === 0)).toEqual([
      { sort: 0, position: 'DFC', points: 1 },
      { sort: 0, position: 'MCD', points: 3 },
      { sort: 0, position: 'MC', points: 2 },
    ]);
  });

  it('la base de datos impide dos correctas en un ítem de preparación', async () => {
    const { db } = connection;
    const [item] = await db.select({ id: prepItem.id }).from(prepItem).limit(1);
    await expect(
      db.execute(sql`update prep_option set is_correct = true where item_id = ${item!.id}`),
    ).rejects.toThrow();
  });
});
