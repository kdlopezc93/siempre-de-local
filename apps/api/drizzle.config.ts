import { defineConfig } from 'drizzle-kit';

try {
  process.loadEnvFile('.env');
} catch {
  // Sin .env (CI): DATABASE_URL llega del entorno.
}

const databaseUrl = process.env['DATABASE_URL'];
if (!databaseUrl) throw new Error('Falta DATABASE_URL');

export default defineConfig({
  dialect: 'postgresql',
  schema: './src/shared/db/schema.ts',
  out: './drizzle',
  dbCredentials: { url: databaseUrl },
  casing: 'snake_case',
  strict: true,
  verbose: true,
});
