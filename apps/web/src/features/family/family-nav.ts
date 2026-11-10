import type { Child, Match } from '@sdl/contracts';

import type { HeaderKid } from '../../shared/ui/TeamHeader';

/**
 * La app del acudiente (escuelas, PR 3, 2026-11-10): cada hijo en cada uno de sus grupos es un
 * "puesto" que se elige arriba, como un equipo. Sus pantallas cuelgan de
 * /deportistas/:minorId/equipos/:teamId.
 */

/** Nombre de pila: así se le dice al niño en la app ("¿Sofía va?"). */
export const firstName = (name: string) => name.trim().split(/\s+/)[0] || name;

export function kidSeats(children: readonly Child[]): HeaderKid[] {
  return children.flatMap((child) =>
    child.teams.map(({ team, club }) => ({
      id: child.id,
      teamId: team.id,
      name: firstName(child.name),
      group: `${team.name}, ${club.name}`,
    })),
  );
}

export type KidTab = 'inicio' | 'partidos' | 'cuentas';

export function kidPath(seat: { id: string; teamId: string }, tab: KidTab = 'inicio'): string {
  const base = `/deportistas/${seat.id}/equipos/${seat.teamId}`;
  return tab === 'inicio' ? base : `${base}/${tab}`;
}

/** Las pestañas del acudiente: inicio, partidos y cuentas del niño elegido. */
export function kidTabs(seat: { id: string; teamId: string }) {
  return [
    { id: 'inicio', label: 'Inicio', to: kidPath(seat) },
    { id: 'partidos', label: 'Partidos', to: kidPath(seat, 'partidos') },
    { id: 'cuentas', label: 'Cuentas', to: kidPath(seat, 'cuentas') },
  ] as const;
}

/** La pestaña de la ruta: partidos (y un partido), cuentas o el inicio. */
export function kidTabOf(pathname: string): KidTab {
  if (/\/partidos(\/|$)/.test(pathname)) return 'partidos';
  if (/\/cuentas$/.test(pathname)) return 'cuentas';
  return 'inicio';
}

const KEY = 'sdl.deportistaActivo';

/** El último puesto de hijo que se vio en este celular (una comodidad: puede fallar). */
export function readLastKid(): { id: string; teamId: string } | null {
  try {
    const [id, teamId] = (localStorage.getItem(KEY) ?? '').split(':');
    return id && teamId ? { id, teamId } : null;
  } catch {
    return null;
  }
}

/** `null` lo olvida: el acudiente volvió a uno de sus equipos. */
export function writeLastKid(seat: { id: string; teamId: string } | null) {
  try {
    if (seat) localStorage.setItem(KEY, `${seat.id}:${seat.teamId}`);
    else localStorage.removeItem(KEY);
  } catch {
    // Sin almacenamiento, el inicio abre en el primero.
  }
}

/**
 * A dónde abre "/" para quien tiene hijos: el último hijo que vio si sigue siéndolo; si no tiene
 * equipos propios, su primer hijo. null: el inicio de su equipo.
 */
export function homeKid(
  seats: readonly HeaderKid[],
  hasTeams: boolean,
  last: { id: string; teamId: string } | null,
): HeaderKid | null {
  const remembered = last && seats.find((s) => s.id === last.id && s.teamId === last.teamId);
  if (remembered) return remembered;
  return hasTeams ? null : (seats[0] ?? null);
}

/**
 * Lo que toca por el niño: la próxima convocatoria abierta (la primera sin responder; si las
 * respondió todas, la más próxima) y cuántas quedan sin responder.
 */
export function nextCall(items: readonly Match[]): { lead: Match | null; unanswered: number } {
  const open = items
    .filter((m) => m.open && m.status !== 'cancelled')
    .sort((a, b) => a.startsAt.localeCompare(b.startsAt));
  const pending = open.filter((m) => !m.myReply);
  return { lead: pending[0] ?? open[0] ?? null, unanswered: pending.length };
}
