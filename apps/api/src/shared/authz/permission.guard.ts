import {
  type CanActivate,
  type ExecutionContext,
  ForbiddenException,
  Inject,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { z } from 'zod';

import { AUTHORIZATION_READER, type AuthorizationReader } from './actor.port.js';
import type { AuthenticatedRequest } from './authenticated-request.js';
import { REQUIRED_PERMISSION, type RequiredPermission } from './can.decorator.js';
import { can, type Actor } from './policy.js';

const TeamIdSchema = z.uuid();

/** Guard global que va después de SessionGuard: aplica `@Can(...)` si la ruta lo declara. */
@Injectable()
export class PermissionGuard implements CanActivate {
  constructor(
    private readonly reflector: Reflector,
    @Inject(AUTHORIZATION_READER) private readonly reader: AuthorizationReader,
  ) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const required = this.reflector.getAllAndOverride<RequiredPermission | undefined>(
      REQUIRED_PERMISSION,
      [context.getHandler(), context.getClass()],
    );
    if (!required) return true;

    const request = context.switchToHttp().getRequest<AuthenticatedRequest>();
    const actor = await loadActor(request, this.reader);

    const params = request.params as Record<string, string | undefined>;
    const teamId = TeamIdSchema.safeParse(params[required.teamParam]);
    // Id mal formado o equipo inexistente: lo mismo, no hay equipo.
    const clubId = teamId.success ? await this.reader.findTeamClubId(teamId.data) : null;
    if (!teamId.success || !clubId) throw new NotFoundException('Equipo no encontrado');

    if (!can(actor, required.permission, { teamId: teamId.data, clubId })) {
      throw new ForbiddenException('No tienes permiso para esto');
    }
    return true;
  }
}

/** Membresías del usuario de la sesión, cargadas una sola vez por petición. */
export async function loadActor(
  request: AuthenticatedRequest,
  reader: AuthorizationReader,
): Promise<Actor> {
  if (request.actor) return request.actor;
  const session = request.authSession;
  if (!session) throw new Error('PermissionGuard en una ruta sin sesión');

  const memberships = await reader.loadMemberships(session.user.id);
  request.actor = {
    userId: session.user.id,
    platformAdmin: session.user.platformAdmin,
    ...memberships,
  };
  return request.actor;
}
