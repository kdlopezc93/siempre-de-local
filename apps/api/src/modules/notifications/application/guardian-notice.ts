import type { PushMessage } from '../../../shared/notifications/notifier.port.js';
import type { MinorGuardian } from './ports/push.ports.js';

const MATCH = /^\/equipos\/([^/]+)\/partidos(\/[^/?#]+)?$/;
const MY_CHARGES = /^\/equipos\/([^/]+)\/mis-cuentas$/;

/** La pantalla del niño en la app del acudiente que corresponde a la del jugador. */
export function guardianUrl(url: string, minorId: string): string {
  const base = `/deportistas/${minorId}`;
  const match = MATCH.exec(url);
  if (match) return `${base}/equipos/${match[1]}/partidos${match[2] ?? ''}`;
  const charges = MY_CHARGES.exec(url);
  if (charges) return `${base}/equipos/${charges[1]}/cuentas`;
  return base;
}

/**
 * La copia de un aviso para el acudiente de un menor (escuelas, 2026-11-10), o null si no le
 * toca: el recordatorio del test es del jugador (los menores no lo hacen todavía). Lleva el
 * nombre de pila del niño, nada más de él.
 */
export function guardianNotice(message: PushMessage, minor: MinorGuardian): PushMessage | null {
  if (message.kind === 'test-reminder') return null;
  const firstName = minor.minorName.trim().split(/\s+/)[0] ?? minor.minorName;
  return { ...message, child: firstName, url: guardianUrl(message.url, minor.minorId) };
}
