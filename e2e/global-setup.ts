import { execFileSync } from 'node:child_process';
import { writeFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { POLICY_VERSION } from '@sdl/contracts';
import { makeSignature } from 'better-auth/crypto';
import pg from 'pg';

import { apiEnv, E2E, e2eDatabaseUrl } from './env.js';

const API_DIR = fileURLToPath(new URL('../apps/api', import.meta.url));
export const FIXTURES = fileURLToPath(new URL('./.fixtures.json', import.meta.url));

/** Cookie de sesión firmada como la emite Better Auth (sin __Secure-: e2e va por http). */
async function session(client: pg.Client, name: string, email: string) {
  const { rows } = await client.query<{ id: string }>(
    `insert into "user" (name, email, email_verified) values ($1, $2, true) returning id`,
    [name, email],
  );
  const userId = rows[0]!.id;
  const token = `e2e-${userId}`;
  await client.query(
    `insert into session (user_id, token, expires_at) values ($1, $2, now() + interval '1 day')`,
    [userId, token],
  );
  const value = `${token}.${await makeSignature(token, E2E.secret)}`;
  return { userId, cookie: { name: 'sdl.session_token', value } };
}

/** Base nueva en cada corrida: migraciones y contenido reales, y un equipo con su entrenador. */
export default async function globalSetup() {
  const admin = new pg.Client({ connectionString: E2E.adminUrl });
  await admin.connect();
  await admin.query(`drop database if exists ${E2E.database} with (force)`);
  await admin.query(`create database ${E2E.database}`);
  await admin.end();

  const env = { ...process.env, ...apiEnv() };
  execFileSync('node', ['dist/scripts/migrate.js'], { cwd: API_DIR, env, stdio: 'inherit' });
  execFileSync('node', ['dist/scripts/seed.js'], { cwd: API_DIR, env, stdio: 'inherit' });

  const db = new pg.Client({ connectionString: e2eDatabaseUrl() });
  await db.connect();
  const coach = await session(db, 'Profe Ramírez', 'profe@example.com');
  const player = await session(db, 'Jugador Nuevo', 'jugador@example.com');
  await db.query(
    `insert into data_consent (user_id, policy_version, age_confirmed)
     select $1, $2, true`,
    [coach.userId, POLICY_VERSION],
  );
  const { rows } = await db.query<{ id: string }>(
    `with c as (insert into club (name, slug) values ('Los del Barrio', 'los-del-barrio') returning id)
     insert into team (club_id, name, format, formats, season) select id, 'Primer equipo', 'F11', '{F11}', '2026' from c
     returning id`,
  );
  const teamId = rows[0]!.id;
  await db.query(`insert into team_membership (team_id, user_id, role) values ($1, $2, 'coach')`, [
    teamId,
    coach.userId,
  ]);
  await db.end();

  writeFileSync(FIXTURES, JSON.stringify({ teamId, coach: coach.cookie, player: player.cookie }));
}
