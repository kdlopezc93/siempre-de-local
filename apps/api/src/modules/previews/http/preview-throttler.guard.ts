import { createHash, timingSafeEqual } from 'node:crypto';
import { isIP } from 'node:net';

import { Inject, Injectable } from '@nestjs/common';
import { ThrottlerGuard } from '@nestjs/throttler';

import { ENV } from '../../../config/config.module.js';
import type { Env } from '../../../config/env.js';
import { clientIp } from '../../../shared/http/client-ip.js';

/** Los encabezados con que la función de Cloudflare Pages dice por quién pregunta. */
export const PREVIEW_KEY_HEADER = 'x-preview-key';
export const PREVIEW_CLIENT_IP_HEADER = 'x-preview-client-ip';

const digest = (value: string) => createHash('sha256').update(value).digest();
const first = (value: string | string[] | undefined) => (Array.isArray(value) ? value[0] : value);

/**
 * El tope de las vistas previas (auditoría 2026-11-11, hallazgo 4): las pide la función de
 * Pages, que llega a Fly desde las IP de salida de Cloudflare. Contar por esa IP dejaba que
 * cualquiera llenara el tope de todos. Si la petición trae `PREVIEW_SECRET`, se cuenta por la
 * IP del cliente que la función reenvía (`CF-Connecting-IP`); sin la clave, por la IP real
 * (`clientIp`), así nadie se salta el tope inventando el encabezado.
 */
@Injectable()
export class PreviewThrottlerGuard extends ThrottlerGuard {
  @Inject(ENV) private readonly env!: Env;

  protected override getTracker(request: Record<string, unknown>): Promise<string> {
    const req = request as { headers: Record<string, string | string[] | undefined>; ip: string };
    const secret = this.env.PREVIEW_SECRET;
    const key = first(req.headers[PREVIEW_KEY_HEADER]);
    const forwarded = first(req.headers[PREVIEW_CLIENT_IP_HEADER])?.trim();
    if (secret && key && forwarded && isIP(forwarded)) {
      // Comparar los resúmenes: mismo largo y en tiempo constante.
      if (timingSafeEqual(digest(key), digest(secret))) return Promise.resolve(`cf:${forwarded}`);
    }
    return Promise.resolve(clientIp(req));
  }
}
