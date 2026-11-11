import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import type { StartedPostgreSqlContainer } from '@testcontainers/postgresql';
import { LinkPreviewSchema } from '@sdl/contracts';
import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';

import { createDb, type DbConnection } from '../../../shared/db/client.js';
import { bootApp, TEST_ENV } from '../../../test/app.js';
import { startMigratedPostgres } from '../../../test/postgres.js';
import { charge } from '../../charges/infrastructure/schema.js';
import { teamMatch } from '../../matches/infrastructure/schema.js';
import { bootstrapTeam } from '../../teams/infrastructure/bootstrap-team.js';
import { seedUserWithSession } from '../../../test/sessions.js';

describe('vista previa de los enlaces (2026-11-06, ADR-10)', () => {
  let container: StartedPostgreSqlContainer;
  let connection: DbConnection;
  let app: NestFastifyApplication;
  let matchId: string, chargeId: string;

  beforeAll(async () => {
    container = await startMigratedPostgres();
    const url = container.getConnectionUri();
    connection = createDb(url);
    await seedUserWithSession(url, { name: 'owner', email: 'owner@example.com' });
    const { teamId } = await bootstrapTeam(connection.db, {
      clubName: 'Los del Barrio',
      clubSlug: 'los-del-barrio',
      format: 'F11',
      teamName: 'QLeones FC',
      season: '2026',
      ownerEmail: 'owner@example.com',
      coachEmail: 'owner@example.com',
    });
    const [match] = await connection.db
      .insert(teamMatch)
      .values({
        teamId,
        kind: 'friendly',
        format: 'F11',
        // Sábado 7 nov, 3:00 p. m. en Colombia.
        startsAt: new Date('2026-11-07T20:00:00Z'),
        place: 'La 14',
        opponent: 'Real Bosa',
      })
      .returning({ id: teamMatch.id });
    matchId = match!.id;
    const [vaca] = await connection.db
      .insert(charge)
      .values({ teamId, kind: 'vaca', matchId, split: 'per_person', amount: 8000 })
      .returning({ id: charge.id });
    chargeId = vaca!.id;
    app = await bootApp(url);
  });

  afterAll(async () => {
    await app?.close();
    await connection?.pool.end();
    vi.unstubAllEnvs();
    await container?.stop();
  });

  const get = (path: string) => app.inject({ method: 'GET', url: `/api/v1/previews/${path}` });

  it('el partido, sin sesión: el equipo, el rival y la hora de Colombia', async () => {
    const res = await get(`matches/${matchId}`);
    expect(res.statusCode).toBe(200);
    expect(res.headers['cache-control']).toBe('public, max-age=300');
    expect(LinkPreviewSchema.parse(res.json())).toEqual({
      title: 'QLeones FC vs Real Bosa',
      description: 'Sábado 7 nov, 3:00 p. m. · ¿Vas?',
      image: `/api/v1/previews/matches/${matchId}/image.png`,
    });
  });

  it('el cobro: de qué es, nunca cuánto', async () => {
    const res = await get(`charges/${chargeId}`);
    const body = LinkPreviewSchema.parse(res.json());
    expect(body.title).toBe('QLeones FC: Vaca');
    expect(body.description).toMatch(/^Vs Real Bosa, sábado 7 nov\. Avisa en la app/);
    expect(JSON.stringify(body)).not.toMatch(/8\.?000/);
  });

  it('la imagen es un PNG de 1200×630', async () => {
    const res = await get(`matches/${matchId}/image.png`);
    expect(res.statusCode).toBe(200);
    expect(res.headers['content-type']).toBe('image/png');
    const png = res.rawPayload;
    expect(png.subarray(1, 4).toString()).toBe('PNG');
    expect([png.readUInt32BE(16), png.readUInt32BE(20)]).toEqual([1200, 630]);
  });

  it('un id que no existe o no es un id: 404 o 400', async () => {
    expect((await get(`matches/0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f00`)).statusCode).toBe(404);
    expect((await get('matches/x')).statusCode).toBe(400);
    expect((await get(`otros/${matchId}`)).statusCode).toBe(400);
  });

  // El tope (120/min) se cuenta por cliente: con la clave, por la IP que reenvía la función de
  // Pages; sin ella, el encabezado no sirve para saltarse el tope (auditoría 2026-11-11).
  it('el tope de uno no deja sin vistas previas a los demás', async () => {
    const missing = 'matches/0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f01';
    const viaPages = (clientIp: string, key: string = TEST_ENV.PREVIEW_SECRET) =>
      app.inject({
        method: 'GET',
        url: `/api/v1/previews/${missing}`,
        headers: {
          'fly-client-ip': '198.51.100.1',
          'x-preview-key': key,
          'x-preview-client-ip': clientIp,
        },
      });

    for (let i = 0; i < 120; i++) expect((await viaPages('203.0.113.66')).statusCode).toBe(404);
    expect((await viaPages('203.0.113.66')).statusCode).toBe(429);
    // Otro cliente, por la misma IP de Cloudflare: sigue viendo su vista previa.
    expect((await viaPages('203.0.113.7')).statusCode).toBe(404);

    // Sin la clave correcta, cuenta la IP que llega a Fly, aunque invente otra.
    for (let i = 0; i < 120; i++) {
      expect((await viaPages(`203.0.113.${i % 250}`, 'otra-clave')).statusCode).toBe(404);
    }
    expect((await viaPages('192.0.2.200', 'otra-clave')).statusCode).toBe(429);
  });
});
