/**
 * La app en el equipo (2026-11-06, Kevin): cuántos la usan y a quién recordarle. Al cuerpo
 * técnico le llega si alguien entró esta semana o antes, nunca la hora ni qué hizo (política de
 * datos §4).
 */
export type SeenBucket = 'week' | 'older';

/** "Esta semana": los últimos 7 días. */
export const ACTIVE_DAYS = 7;

/** Si entró en los últimos 7 días; sin ninguna sesión guardada, "antes". */
export function seenBucket(lastSeen: Date | null, now: Date): SeenBucket {
  if (!lastSeen) return 'older';
  return now.getTime() - lastSeen.getTime() <= ACTIVE_DAYS * 86_400_000 ? 'week' : 'older';
}
