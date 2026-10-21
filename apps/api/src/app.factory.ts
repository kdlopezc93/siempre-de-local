import type { NestApplicationOptions } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import { AppModule } from './app.module.js';
import { ENV } from './config/config.module.js';
import type { Env } from './config/env.js';
import { HttpExceptionFilter } from './shared/errors/http-exception.filter.js';
import { registerOriginCheck } from './shared/http/origin-check.js';

/** Construye la app con la misma configuración en main.ts y en los tests. */
export async function createApp(
  options: NestApplicationOptions = {},
): Promise<NestFastifyApplication> {
  // trustProxy: en local y en producción el API va detrás de un proxy HTTPS.
  const app = await NestFactory.create<NestFastifyApplication>(
    AppModule,
    new FastifyAdapter({ trustProxy: true }),
    { bufferLogs: true, ...options },
  );
  const env = app.get<Env>(ENV);

  app.setGlobalPrefix('api/v1');
  app.useGlobalFilters(new HttpExceptionFilter());
  app.enableCors({ origin: env.WEB_ORIGIN, credentials: true });
  registerOriginCheck(app.getHttpAdapter().getInstance(), env.WEB_ORIGIN);
  app.enableShutdownHooks();
  return app;
}
