/**
 * El reloj del examen. El plazo lo fija el servidor; el celular puede tener la hora
 * corrida (p. ej. 2 minutos adelantado), así que se mide con la diferencia entre la hora
 * del servidor y la del celular al recibir el examen.
 */
export function clockOffsetMs(serverNow: string, receivedAt: number): number {
  return Date.parse(serverNow) - receivedAt;
}

/** Milisegundos que quedan, según la hora del servidor; nunca negativo. */
export function remainingMs(deadlineAt: string, offsetMs: number, now: number): number {
  return Math.max(0, Date.parse(deadlineAt) - (now + offsetMs));
}

/** "18:05", "0:09". */
export function formatClock(ms: number): string {
  const total = Math.ceil(ms / 1000);
  return `${Math.floor(total / 60)}:${String(total % 60).padStart(2, '0')}`;
}

export type ClockTone = 'calm' | 'hurry' | 'last';

/** Ámbar en los últimos 2 minutos; rojo en el último. */
export function clockTone(ms: number): ClockTone {
  if (ms <= 60_000) return 'last';
  if (ms <= 120_000) return 'hurry';
  return 'calm';
}

/** Avisos para lectores de pantalla: solo al cruzar estos umbrales, no cada segundo. */
export const CLOCK_ANNOUNCEMENTS = [5 * 60_000, 2 * 60_000, 60_000] as const;
