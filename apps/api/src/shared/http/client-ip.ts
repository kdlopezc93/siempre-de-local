import { isIP } from 'node:net';

/**
 * La IP del cliente para los límites de intentos (auditoría 2026-11-10, M1). Fly pone
 * `Fly-Client-IP` con la IP real y reemplaza la que mande el cliente; `X-Forwarded-For`, en
 * cambio, lo puede inventar el cliente (con `trustProxy`, Fastify tomaba la primera, la suya).
 * Fuera de Fly (local, tests), la IP que resuelve Fastify.
 */
export function clientIp(request: {
  headers: Record<string, string | string[] | undefined>;
  ip: string;
}): string {
  const fly = request.headers['fly-client-ip'];
  const value = Array.isArray(fly) ? fly[0] : fly;
  return value && isIP(value.trim()) ? value.trim() : request.ip;
}
