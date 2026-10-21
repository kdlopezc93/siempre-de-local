import type { FastifyRequest } from 'fastify';

import type { AuthSession } from '../../modules/identity/application/ports/identity-provider.port.js';
import type { Actor } from './policy.js';

export type AuthenticatedRequest = FastifyRequest & {
  authSession?: AuthSession;
  /** Membresías cargadas una vez por petición por PermissionGuard. */
  actor?: Actor;
};
