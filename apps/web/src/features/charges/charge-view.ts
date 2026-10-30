import type { ChargeShare, ChargeSummary } from '@sdl/contracts';
import { CHARGE_KIND_LABELS, type ChargeKind } from '@sdl/domain';

import { matchDay } from '../matches/match-view';

const PESOS = new Intl.NumberFormat('es-CO', { maximumFractionDigits: 0 });

/** "$70.000": pesos enteros, con punto de miles como en Colombia. */
export const pesos = (amount: number) => `$${PESOS.format(amount)}`;

/** Lo que alguien escribe en el campo de plata ("70.000", "$ 70000") en pesos; null si no hay. */
export function parsePesos(text: string): number | null {
  const digits = text.replace(/\D/g, '');
  return digits ? Number(digits) : null;
}

/** El nombre del cobro: su título, o el tipo ("Vaca", "Inscripción"). */
export const chargeTitle = (c: Pick<ChargeSummary, 'kind' | 'title'>) =>
  c.title ?? CHARGE_KIND_LABELS[c.kind as ChargeKind];

/** De qué es: "Contra Los Pibes, sáb, 2 nov", "Entrenamiento, …", el torneo, o nada (suelto). */
export function chargeContext(c: Pick<ChargeSummary, 'match' | 'tournament'>): string | null {
  if (c.match) {
    const who = c.match.opponent ? `Contra ${c.match.opponent}` : 'Entrenamiento';
    return `${who}, ${matchDay(c.match.startsAt)}`;
  }
  return c.tournament?.name ?? null;
}

const DUE = new Intl.DateTimeFormat('es-419', { day: 'numeric', month: 'short', timeZone: 'UTC' });

/** "vence el 5 nov" (la fecha es un día, sin hora). */
export const dueLine = (dueOn: string) => `vence el ${DUE.format(new Date(`${dueOn}T00:00:00Z`))}`;

export type VacaMark = 'paid' | 'partial' | 'pending';

/**
 * La fila de la vaca: una marca por persona, primero los que pagaron, después los que abonaron y
 * al final los que deben. Con su etiqueta en palabras para el lector de pantalla.
 */
export function vacaMarks(shares: readonly Pick<ChargeShare, 'status'>[]): {
  marks: VacaMark[];
  label: string;
} {
  const count = { paid: 0, partial: 0, pending: 0 };
  for (const s of shares) count[s.status]++;
  const marks: VacaMark[] = [
    ...Array<VacaMark>(count.paid).fill('paid'),
    ...Array<VacaMark>(count.partial).fill('partial'),
    ...Array<VacaMark>(count.pending).fill('pending'),
  ];
  const parts = [
    count.paid && `${count.paid} ${count.paid === 1 ? 'pagó' : 'pagaron'}`,
    count.partial && `${count.partial} ${count.partial === 1 ? 'abonó' : 'abonaron'}`,
    count.pending && `${count.pending} ${count.pending === 1 ? 'debe' : 'deben'}`,
  ].filter(Boolean) as string[];
  const label =
    parts.length > 1 ? `${parts.slice(0, -1).join(', ')} y ${parts.at(-1)}` : (parts[0] ?? '');
  return { marks, label };
}

/** Para la lista: con el resumen se sabe cuántos pagaron todo, no quién abonó. */
export function summaryMarks(c: Pick<ChargeSummary, 'people' | 'paidPeople'>) {
  return vacaMarks([
    ...Array(c.paidPeople).fill({ status: 'paid' as const }),
    ...Array(c.people - c.paidPeople).fill({ status: 'pending' as const }),
  ]);
}

/** El estado de cada uno, en palabras (con "Por confirmar" si espera un "Ya pagué"). */
export function shareBadge(s: Pick<ChargeShare, 'status' | 'reported'>): {
  label: string;
  tone: 'success' | 'warning' | 'danger' | 'brand';
} {
  if (s.status === 'paid') return { label: 'Pagó', tone: 'success' };
  if (s.reported > 0) return { label: 'Por confirmar', tone: 'brand' };
  if (s.status === 'partial') return { label: 'Abonó', tone: 'warning' };
  return { label: 'Debe', tone: 'danger' };
}

/** Hoy en el celular, como día (YYYY-MM-DD). */
export function today(now = new Date()): string {
  const local = new Date(now.getTime() - now.getTimezoneOffset() * 60_000);
  return local.toISOString().slice(0, 10);
}
