import type { NestApplicationOptions } from '@nestjs/common';
import { NestFactory } from '@nestjs/core';
import { FastifyAdapter, type NestFastifyApplication } from '@nestjs/platform-fastify';

import { AppModule } from './app.module.js';
import { ENV } from './config/config.module.js';
import type { Env } from './config/env.js';
import { HttpExceptionFilter } from './shared/errors/http-exception.filter.js';
import { registerOriginCheck } from './shared/http/origin-check.js';
import { MAX_PHOTO_BYTES } from './shared/photos/clean-photo.js';

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
  // Las fotos llegan como bytes (WebP o JPEG), no como JSON; las limpia cleanPhoto.
  app
    .getHttpAdapter()
    .getInstance()
    .addContentTypeParser(
      ['image/webp', 'image/jpeg'],
      { parseAs: 'buffer', bodyLimit: MAX_PHOTO_BYTES },
      (_request, body, done) => done(null, body),
    );
  app.enableShutdownHooks();
  return app;
}
