import { parseArgs } from 'node:util';

import { eq, sql } from 'drizzle-orm';
import { z } from 'zod';

import { user } from '../modules/identity/infrastructure/schema.js';
import { createDb } from '../shared/db/client.js';

/**
 * pnpm admin:platform-admin -- --email kevin@gmail.com [--revoke]
 *
 * Marca (o desmarca) a alguien como administrador de la plataforma: genera los códigos de alta
 * de clubes desde Tu cuenta (2026-10-29). Tiene que haber entrado una vez con Google; el cambio
 * se ve al volver a entrar.
 */
const { values } = parseArgs({
  // pnpm reenvía el `--` separador; no es un argumento.
  args: process.argv.slice(2).filter((arg) => arg !== '--'),
  options: { email: { type: 'string' }, revoke: { type: 'boolean', default: false } },
});

const email = z.email().safeParse(values.email);
if (!email.success) {
  console.error('Falta --email con un correo válido.');
  process.exit(1);
}

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) throw new Error('Falta DATABASE_URL');

const { db, pool } = createDb(databaseUrl);
try {
  const updated = await db
    .update(user)
    .set({ platformAdmin: !values.revoke })
    .where(eq(sql`lower(${user.email})`, email.data.toLowerCase()))
    .returning({ name: user.name });
  if (updated.length === 0) {
    console.error(
      `${email.data} todavía no ha entrado a la app. Pídele que entre una vez con Google.`,
    );
    process.exitCode = 1;
  } else {
    console.log(
      `${updated[0]!.name} ${values.revoke ? 'ya no es' : 'ahora es'} administrador de la plataforma.`,
    );
  }
} finally {
  await pool.end();
}
