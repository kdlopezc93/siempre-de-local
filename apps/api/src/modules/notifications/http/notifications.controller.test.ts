import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { PushPublicKeyResponseSchema } from '@sdl/contracts';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createDb, type DbConnection } from '../../../shared/db/client.js';
import { bootApp, TEST_ENV } from '../../../test/app.js';
import { startMigratedPostgres } from '../../../test/postgres.js';
import { seedUserWithSession, type SeededUser } from '../../../test/sessions.js';
import { pushSubscription } from '../infrastructure/schema.js';

describe('suscribirse a los avisos (Web Push)', () => {
  let container: StartedPostgreSqlContainer;
  let connection: DbConnection;
  let app: NestFastifyApplication;
  let ana: SeededUser, beto: SeededUser;

  beforeAll(async () => {
    container = await startMigratedPostgres();
    const url = container.getConnectionUri();
    connection = createDb(url);
    ana = await seedUserWithSession(url, { name: 'ana', email: 'ana@example.com' });
    beto = await seedUserWithSession(url, { name: 'beto', email: 'beto@example.com' });
    app = await bootApp(url);
  });

  afterAll(async () => {
    await app?.close();
    await connection?.pool.end();
    vi.unstubAllEnvs();
    await container?.stop();
  });

  const call = (method: 'GET' | 'POST' | 'DELETE', url: string, who: SeededUser, body?: object) =>
    app.inject({
      method,
      url: `/api/v1${url}`,
      headers: { cookie: who.cookie, origin: TEST_ENV.WEB_ORIGIN },
      ...(body ? { payload: body } : {}),
    });
  const SUB = {
    endpoint: 'https://fcm.googleapis.com/fcm/send/abc',
    keys: { p256dh: 'BKey', auth: 'auth' },
  };

  it('sin llaves configuradas, la llave pública es null (los avisos quedan apagados)', async () => {
    const res = await call('GET', '/push/public-key', ana);
    expect(PushPublicKeyResponseSchema.parse(res.json())).toEqual({ publicKey: null });
  });

  it('guarda la suscripción del celular; si cambia de cuenta, pasa a la nueva; se borra al apagar', async () => {
    expect((await call('POST', '/me/push-subscriptions', ana, SUB)).statusCode).toBe(204);
    expect((await call('POST', '/me/push-subscriptions', ana, SUB)).statusCode).toBe(204);
    let rows = await connection.db.select().from(pushSubscription);
    expect(rows).toHaveLength(1);
    expect(rows[0]!.userId).toBe(ana.userId);

    // El mismo celular, otra cuenta: la suscripción pasa a ella.
    await call('POST', '/me/push-subscriptions', beto, SUB);
    rows = await connection.db.select().from(pushSubscription);
    expect(rows.map((r) => r.userId)).toEqual([beto.userId]);

    // Ana ya no la tiene: su DELETE no borra la de Beto.
    await call('DELETE', '/me/push-subscriptions', ana, { endpoint: SUB.endpoint });
    expect(await connection.db.select().from(pushSubscription)).toHaveLength(1);
    await call('DELETE', '/me/push-subscriptions', beto, { endpoint: SUB.endpoint });
    expect(await connection.db.select().from(pushSubscription)).toHaveLength(0);
  });

  it('solo endpoints https', async () => {
    const res = await call('POST', '/me/push-subscriptions', ana, {
      ...SUB,
      endpoint: 'http://evil/x',
    });
    expect(res.statusCode).toBe(400);
  });
});
