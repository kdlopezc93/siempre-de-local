import type { FastifyInstance } from 'fastify';

import type { ErrorBody } from '@sdl/contracts';

const SAFE_METHODS = new Set(['GET', 'HEAD', 'OPTIONS']);

/**
 * CSRF (04 §1): además de SameSite=Lax, los métodos que modifican solo se aceptan desde el
 * origen de la PWA. Better Auth valida sus propias rutas (`/api/auth/*`) y las de
 * `/api/v1/cron/` (sin cookie, con clave) las valida `CronGuard`.
 *
 * Las excepciones se deciden con la ruta que eligió el enrutador, nunca con la URL cruda: el
 * enrutador decodifica la ruta (`/%61pi/v1/...` → `/api/v1/...`), así que un prefijo crudo
 * dejaba pasar peticiones codificadas sin chequeo (auditoría 2026-11-11).
 */
export function registerOriginCheck(fastify: FastifyInstance, allowedOrigin: string): void {
  fastify.addHook('onRequest', async (request, reply) => {
    if (SAFE_METHODS.has(request.method)) return;
    if (isExempt(request.routeOptions.url)) return;
    if (request.headers.origin === allowedOrigin) return;

    const body: ErrorBody = {
      error: { code: 'FORBIDDEN_ORIGIN', message: 'Origen no permitido' },
    };
    return reply.status(403).send(body);
  });
}

/** Rutas con su propia defensa: Better Auth (su chequeo de origen) y las tareas programadas. */
function isExempt(route: string | undefined): boolean {
  if (!route) return false;
  return route.startsWith('/api/auth/') || route.startsWith('/api/v1/cron/');
}
