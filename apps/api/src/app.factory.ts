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
  // @fastify/cors solo permite GET, HEAD y POST por defecto: hay que declarar el resto.
  app.enableCors({
    origin: env.WEB_ORIGIN,
    credentials: true,
    methods: ['GET', 'HEAD', 'POST', 'PUT', 'PATCH', 'DELETE'],
  });
  registerOriginCheck(app.getHttpAdapter().getInstance(), env.WEB_ORIGIN);
  const secure = env.BETTER_AUTH_URL.startsWith('https://');
  // El API solo responde JSON (y archivos): que el navegador no interprete nada más (`04`).
  app
    .getHttpAdapter()
    .getInstance()
    .addHook('onSend', async (_request, reply, payload) => {
      reply.header('X-Content-Type-Options', 'nosniff');
      reply.header('Referrer-Policy', 'no-referrer');
      reply.header('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'");
      // Siempre por HTTPS (auditoría 2026-11-10, L1): el navegador no vuelve a intentar http.
      if (secure) reply.header('Strict-Transport-Security', 'max-age=31536000; includeSubDomains');
      return payload;
    });
  app.enableShutdownHooks();
  return app;
}
