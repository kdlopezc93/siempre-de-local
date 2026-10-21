import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';

import {
  IDENTITY_PROVIDER,
  type IdentityProvider,
} from '../../modules/identity/application/ports/identity-provider.port.js';
import { toWebHeaders } from '../http/headers.js';
import type { AuthenticatedRequest } from './authenticated-request.js';
import { IS_PUBLIC } from './public.decorator.js';

/**
 * Guard global: exige sesión salvo en rutas @Public(). Es la primera barrera;
 * la autorización por equipo/rol se decide en application (CLAUDE.md).
 */
@Injectable()
export class SessionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(IDENTITY_PROVIDER) private readonly identity: IdentityProvider,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const isPublic = this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, [
      context.getHandler(),
      context.getClass(),
    ]);
    if (isPublic) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const session = await this.identity.getSession(toWebHeaders(request.headers));
    if (!session) throw new UnauthorizedException('Necesitas iniciar sesión');

    request.authSession = session;
    return true;
  }
}
