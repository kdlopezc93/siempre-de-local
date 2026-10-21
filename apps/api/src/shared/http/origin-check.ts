import type { FastifyInstance } from 'fastify';

import type { ErrorBody } from '@sdl/contracts';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF (04 §1): además de SameSite=Lax, los métodos que modifican en /api/v1
 * solo se aceptan desde el origen de la PWA. Better Auth valida sus propias rutas.
 */
export function registerOriginCheck(fastify: FastifyInstance, allowedOrigin: string): void {
  fastify.addHook('onRequest', async (request, reply) => {
    if (SAFE_METHODS.has(request.method) || !request.url.startsWith('/api/v1/')) return;
    if (request.headers.origin === allowedOrigin) return;

    const body: ErrorBody = {
      error: { code: 'FORBIDDEN_ORIGIN', message: 'Origen no permitido' },
    };
    return reply.status(403).send(body);
  });
}
