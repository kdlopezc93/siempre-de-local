import { createHash, timingSafeEqual } from 'node:crypto';

import {
  type CanActivate,
  type ExecutionContext,
  Inject,
  Injectable,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import type { FastifyRequest } from 'fastify';

import { ENV } from '../../config/config.module.js';
import type { Env } from '../../config/env.js';

const digest = (value: string) => createHash('sha256').update(value).digest();

/**
 * Las tareas programadas (`/api/v1/cron/*`, 2026-10-31) no traen sesión: traen
 * `Authorization: Bearer <CRON_SECRET>`. Sin `CRON_SECRET` configurada, las rutas no existen.
 */
@Injectable()
export class CronGuard implements CanActivate {
  constructor(@Inject(ENV) private readonly env: Env) {}

  canActivate(context: ExecutionContext): boolean {
    const secret = this.env.CRON_SECRET;
    if (!secret) throw new NotFoundException();
    const header = context.switchToHttp().getRequest<FastifyRequest>().headers.authorization;
    const given = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : '';
    // Comparar los resúmenes: mismo largo y en tiempo constante.
    if (!timingSafeEqual(digest(given), digest(secret))) throw new UnauthorizedException();
    return true;
  }
}
