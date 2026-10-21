import { Inject, Injectable, type OnModuleInit } from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import type { FastifyInstance, FastifyReply, FastifyRequest } from 'fastify';

import { ENV } from '../../../config/config.module.js';
import type { Env } from '../../../config/env.js';
import { toWebHeaders } from '../../../shared/http/headers.js';
import type { Auth } from './better-auth.js';

export const BETTER_AUTH = Symbol('BETTER_AUTH');

/**
 * Monta el handler de Better Auth en /api/auth/* directamente sobre Fastify,
 * fuera del enrutado de Nest (sin guard global ni prefijo /api/v1).
 */
@Injectable()
export class BetterAuthRoutes implements OnModuleInit {
  constructor(
    private readonly adapterHost: HttpAdapterHost,
    @Inject(BETTER_AUTH) private readonly auth: Auth,
    @Inject(ENV) private readonly env: Env,
  ) {}

  onModuleInit(): void {
    const fastify = this.adapterHost.httpAdapter.getInstance<FastifyInstance>();
    fastify.route({
      method: ['GET', 'POST'],
      url: '/api/auth/*',
      handler: (request, reply) => this.handle(request, reply),
    });
  }

  private async handle(request: FastifyRequest, reply: FastifyReply): Promise<void> {
    // La URL pública sale de la config, no de la cabecera Host (vamos detrás de Caddy).
    const url = new URL(request.url, this.env.BETTER_AUTH_URL);
    const headers = toWebHeaders(request.headers);
    headers.delete('content-length');

    const hasBody = request.body !== undefined && request.body !== null;
    const response = await this.auth.handler(
      new Request(url, {
        method: request.method,
        headers,
        ...(hasBody ? { body: JSON.stringify(request.body) } : {}),
      }),
    );

    void reply.status(response.status);
    for (const [key, value] of response.headers) {
      if (key !== 'set-cookie') void reply.header(key, value);
    }
    const cookies = response.headers.getSetCookie();
    if (cookies.length > 0) void reply.header('set-cookie', cookies);
    await reply.send(response.body ? await response.text() : null);
  }
}
