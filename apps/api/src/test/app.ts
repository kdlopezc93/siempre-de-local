import type { NestFastifyApplication } from '@nestjs/platform-fastify';
import { vi } from 'vitest';

import { createApp } from '../app.factory.js';

export const TEST_ENV = {
  BETTER_AUTH_URL: 'https://api.sdl.test',
  BETTER_AUTH_SECRET: 'test-secret-que-tiene-mas-de-32-caracteres',
  WEB_ORIGIN: 'https://app.sdl.test',
  COOKIE_DOMAIN: 'sdl.test',
  GOOGLE_CLIENT_ID: 'test-client-id',
  GOOGLE_CLIENT_SECRET: 'test-client-secret',
  CRON_SECRET: 'cron-secret-de-prueba-con-mas-de-32-caracteres',
} as const;

/** Levanta la app completa contra la BD indicada, lista para `app.inject`. */
export async function bootApp(databaseUrl: string): Promise<NestFastifyApplication> {
  for (const [key, value] of Object.entries(TEST_ENV)) vi.stubEnv(key, value);
  vi.stubEnv('DATABASE_URL', databaseUrl);
  const app = await createApp({ logger: false });
  await app.init();
  await app.getHttpAdapter().getInstance().ready();
  return app;
}
