import type { Injury } from '@sdl/contracts';

const DAY = new Intl.DateTimeFormat('es-419', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** "2026-11-15" → "15 nov" (la fecha se guarda sin hora; se muestra tal cual). */
export const returnDay = (isoDate: string) => DAY.format(new Date(`${isoDate}T00:00:00Z`));

/** La fecha de hoy como YYYY-MM-DD, en la hora del celular. */
export function todayIso(now = new Date()): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}

/** Si ya pasó la vuelta estimada y sigue marcado: toca confirmar si volvió. */
export function returnOverdue(injury: Injury | null, today: string): boolean {
  return injury?.returnOn != null && injury.returnOn <= today;
}

/**
 * La línea de un lesionado (2026-10-24): "Lesionado, vuelve el 15 nov", o "debía volver" si
 * la fecha ya pasó y nadie lo desmarcó.
 */
export function injuryText(injury: Injury, today: string): string {
  if (!injury.returnOn) return 'Lesionado';
  return returnOverdue(injury, today)
    ? `Lesionado, debía volver el ${returnDay(injury.returnOn)}`
    : `Lesionado, vuelve el ${returnDay(injury.returnOn)}`;
}

/** Lo que ve el propio jugador en su inicio. */
export function myInjuryText(injury: Injury, today: string): string {
  if (!injury.returnOn) return 'El cuerpo técnico te marcó como lesionado.';
  return returnOverdue(injury, today)
    ? `Sigues marcado como lesionado; la vuelta estaba para el ${returnDay(injury.returnOn)}.`
    : `Estás marcado como lesionado; vuelves más o menos el ${returnDay(injury.returnOn)}.`;
}
