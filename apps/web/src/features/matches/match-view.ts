import type { Match } from '@sdl/contracts';
import { POSITIONS } from '@sdl/domain';

const WHEN = new Intl.DateTimeFormat('es-419', {
  weekday: 'short',
  day: 'numeric',
  month: 'short',
  hour: 'numeric',
  minute: '2-digit',
});

/** "sáb, 1 nov, 3:00 p. m." en la hora del celular. */
export const matchWhen = (iso: string) => WHEN.format(new Date(iso));

/**
 * Próximos (programados que no empezaron, el más cercano primero) y pasados o cancelados (el
 * más reciente primero).
 */
export function splitMatches(items: readonly Match[]): { upcoming: Match[]; past: Match[] } {
  const upcoming = items.filter((m) => m.open).sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const past = items.filter((m) => !m.open).sort((a, b) => b.startsAt.localeCompare(a.startsAt));
  return { upcoming, past };
}

const pad = (n: number) => String(n).padStart(2, '0');

/** De la hora del API a los campos del formulario, en la hora local del celular. */
export function toLocalInputs(iso: string): { date: string; time: string } {
  const d = new Date(iso);
  return {
    date: `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`,
    time: `${pad(d.getHours())}:${pad(d.getMinutes())}`,
  };
}

/** De los campos del formulario (hora local) a la hora con zona que espera el API. */
export function fromLocalInputs(date: string, time: string): string | null {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || !/^\d{2}:\d{2}$/.test(time)) return null;
  const [y, m, d] = date.split('-').map(Number);
  const [h, min] = time.split(':').map(Number);
  const local = new Date(y!, m! - 1, d!, h!, min!);
  return Number.isNaN(local.getTime()) ? null : local.toISOString();
}

/** "Lateral por la izquierda", "Defensa central": el puesto en palabras (la banda es femenina). */
export function slotName(slot: { position: keyof typeof POSITIONS; side?: string }): string {
  const name = POSITIONS[slot.position].name;
  return slot.side ? `${name} por la ${slot.side}` : name;
}
