import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { AuthSession } from '../../modules/identity/application/ports/identity-provider.port.js';
import type { AuthenticatedRequest } from './authenticated-request.js';

/** Sesión validada por SessionGuard. Solo usable en rutas no públicas. */
export const CurrentSession = createParamDecorator(
  (_data: unknown, context: ExecutionContext): AuthSession => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.authSession) throw new Error('CurrentSession usado en una ruta pública');
    return request.authSession;
  },
);
