import type { FastifyRequest } from 'fastify';

import type { AuthSession } from '../../modules/identity/application/ports/identity-provider.port.js';

export type AuthenticatedRequest = FastifyRequest & { authSession?: AuthSession };
