import { makeSignature } from 'better-auth/crypto';
import pg from 'pg';

import { TEST_ENV } from './app.js';

/** Nombre real de la cookie: prefijo `sdl` + `__Secure-` por ir sobre HTTPS. */
export const SESSION_COOKIE = '__Secure-sdl.session_token';

export interface SeededUser {
  userId: string;
  /** Cabecera `cookie` lista para `app.inject`. */
  cookie: string;
}

/** Crea un usuario con sesión y devuelve la cookie firmada como la emite Better Auth. */
export async function seedUserWithSession(
  databaseUrl: string,
  { name, email }: { name: string; email: string },
): Promise<SeededUser> {
  const client = new pg.Client({ connectionString: databaseUrl });
  await client.connect();
  try {
    const { rows } = await client.query<{ id: string }>(
      `insert into "user" (name, email, email_verified) values ($1, $2, true) returning id`,
      [name, email],
    );
    const userId = rows[0]!.id;
    const token = `token-${userId}`;
    await client.query(
      `insert into session (user_id, token, expires_at) values ($1, $2, now() + interval '30 days')`,
      [userId, token],
    );
    const signature = await makeSignature(token, TEST_ENV.BETTER_AUTH_SECRET);
    return { userId, cookie: `${SESSION_COOKIE}=${encodeURIComponent(`${token}.${signature}`)}` };
  } finally {
    await client.end();
  }
}
