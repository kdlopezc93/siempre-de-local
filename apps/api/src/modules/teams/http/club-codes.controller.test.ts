import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import {
  ClubCodeListResponseSchema,
  CreateClubCodeResponseSchema,
  MeResponseSchema,
} from '@sdl/contracts';
import { eq } from 'drizzle-orm';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createDb, type DbConnection } from '../../../shared/db/client.js';
import { bootApp, TEST_ENV } from '../../../test/app.js';
import { startMigratedPostgres } from '../../../test/postgres.js';
import { seedUserWithSession, type SeededUser } from '../../../test/sessions.js';
import { user } from '../../identity/infrastructure/schema.js';
import { clubSignupCode } from '../infrastructure/schema.js';

describe('códigos de alta de clubes (2026-10-29)', () => {
  let container: StartedPostgreSqlContainer;
  let connection: DbConnection;
  let app: NestFastifyApplication;
  let admin: SeededUser, someone: SeededUser;

  const call = (
    method: 'GET' | 'POST' | 'DELETE',
    path: string,
    who: SeededUser,
    payload?: object,
  ) =>
    app.inject({
      method,
      url: `/api/v1${path}`,
      headers: { cookie: who.cookie, origin: TEST_ENV.WEB_ORIGIN },
      ...(payload ? { payload } : {}),
    });

  beforeAll(async () => {
    container = await startMigratedPostgres();
    const url = container.getConnectionUri();
    connection = createDb(url);
    admin = await seedUserWithSession(url, { name: 'Kevin', email: 'kevin@example.com' });
    someone = await seedUserWithSession(url, { name: 'Pedro', email: 'pedro@example.com' });
    await connection.db.update(user).set({ platformAdmin: true }).where(eq(user.id, admin.userId));
    app = await bootApp(url);
  });

  afterAll(async () => {
    await app?.close();
    await connection?.pool.end();
    vi.unstubAllEnvs();
    await container?.stop();
  });

  it('el administrador de la plataforma lo ve en /me; los demás no', async () => {
    expect(
      MeResponseSchema.parse((await call('GET', '/me', admin)).json()).user.platformAdmin,
    ).toBe(true);
    expect(
      MeResponseSchema.parse((await call('GET', '/me', someone)).json()).user.platformAdmin,
    ).toBe(false);
  });

  it('crea un código: viaja una sola vez, con su enlace, y en la BD queda el hash', async () => {
    const res = await call('POST', '/admin/club-codes', admin, { note: 'Pedro, Los Tigres' });
    expect(res.statusCode).toBe(201);
    const created = CreateClubCodeResponseSchema.parse(res.json());
    expect(created.clubCode).toMatchObject({
      note: 'Pedro, Los Tigres',
      status: 'active',
      club: null,
    });
    expect(created.url).toBe(`${TEST_ENV.WEB_ORIGIN}/crear-club/${created.code}`);
    // Vence en 14 días por defecto.
    const days = (Date.parse(created.clubCode.expiresAt) - Date.now()) / 86_400_000;
    expect(Math.round(days)).toBe(14);

    const [row] = await connection.db
      .select()
      .from(clubSignupCode)
      .where(eq(clubSignupCode.id, created.clubCode.id));
    expect(JSON.stringify(row)).not.toContain(created.code);

    const list = ClubCodeListResponseSchema.parse(
      (await call('GET', '/admin/club-codes', admin)).json(),
    );
    expect(list.items[0]!.id).toBe(created.clubCode.id);
    expect(JSON.stringify(list)).not.toContain(created.code);
  });

  it('anular deja el código anulado; uno que no existe da 404', async () => {
    const { clubCode } = CreateClubCodeResponseSchema.parse(
      (await call('POST', '/admin/club-codes', admin, {})).json(),
    );
    expect((await call('DELETE', `/admin/club-codes/${clubCode.id}`, admin)).statusCode).toBe(204);
    const list = ClubCodeListResponseSchema.parse(
      (await call('GET', '/admin/club-codes', admin)).json(),
    );
    expect(list.items.find((c) => c.id === clubCode.id)?.status).toBe('revoked');
    const missing = await call(
      'DELETE',
      '/admin/club-codes/0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f00',
      admin,
    );
    expect(missing.statusCode).toBe(404);
  });

  it('nadie más los crea, los ve ni los anula; valida lo que llega', async () => {
    expect((await call('POST', '/admin/club-codes', someone, {})).statusCode).toBe(403);
    expect((await call('GET', '/admin/club-codes', someone)).statusCode).toBe(403);
    expect(
      (await call('DELETE', '/admin/club-codes/0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f00', someone))
        .statusCode,
    ).toBe(403);
    expect((await call('POST', '/admin/club-codes', admin, { expiresInDays: 0 })).statusCode).toBe(
      400,
    );
    expect((await app.inject({ method: 'GET', url: '/api/v1/admin/club-codes' })).statusCode).toBe(
      401,
    );
  });
});
