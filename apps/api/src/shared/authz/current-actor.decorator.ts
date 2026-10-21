import { createParamDecorator, type ExecutionContext } from '@nestjs/common';

import type { AuthenticatedRequest } from './authenticated-request.js';
import type { Actor } from './policy.js';

/** Actor cargado por PermissionGuard. Solo en rutas con `@Can(...)`. */
export const CurrentActor = createParamDecorator(
  (_data: unknown, context: ExecutionContext): Actor => {
    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    if (!request.actor) throw new Error('CurrentActor usado en una ruta sin @Can');
    return request.actor;
  },
);
