import type { TeamMembersResponse } from '@sdl/contracts';

export interface TeamPerson {
  userId: string;
  displayName: string;
  jerseyNumber: number | null;
  coach: boolean;
  assistant: boolean;
  player: boolean;
  /** Tesorero (2026-10-30): maneja los cobros y pasa lista. */
  treasurer: boolean;
}

/**
 * Cada persona una vez, con sus roles juntos (en Integrantes van por separado: cuerpo técnico y
 * jugadores). Primero el entrenador, después los asistentes y al final los jugadores; dentro de
 * cada grupo, por nombre.
 */
export function teamPeople({ staff, players }: TeamMembersResponse): TeamPerson[] {
  const people = new Map<string, TeamPerson>();
  const person = (userId: string, displayName: string) => {
    const found = people.get(userId);
    if (found) return found;
    const created: TeamPerson = {
      userId,
      displayName,
      jerseyNumber: null,
      coach: false,
      assistant: false,
      player: false,
      treasurer: false,
    };
    people.set(userId, created);
    return created;
  };
  for (const s of staff) person(s.userId, s.displayName)[s.role] = true;
  for (const p of players) {
    const entry = person(p.userId, p.displayName);
    entry.player = true;
    entry.jerseyNumber = p.jerseyNumber;
  }
  const rank = (p: TeamPerson) => (p.coach ? 0 : p.assistant ? 1 : 2);
  return [...people.values()].sort(
    (a, b) => rank(a) - rank(b) || a.displayName.localeCompare(b.displayName, 'es'),
  );
}
