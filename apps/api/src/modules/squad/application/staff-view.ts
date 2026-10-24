import type { Actor } from '../../../shared/authz/policy.js';
import type { LatestResult } from './ports/squad.ports.js';

/** Coach y assistant valoran; el admin del club no (ve los resultados sin más). */
export function assessesIn(actor: Actor, teamId: string): boolean {
  const roles = actor.teams.get(teamId) ?? [];
  return roles.includes('coach') || roles.includes('assistant');
}

/**
 * Qué ve del test quien pregunta. Quien puede valorarlo no lo ve hasta haberlo valorado:
 * así su primera valoración es a ciegas (06 · Fase 3). A quien no puede valorar (él mismo,
 * otro del cuerpo técnico) lo ve sin más.
 */
export function testView(result: LatestResult | undefined, hidden: boolean) {
  if (!result) return { status: 'none' as const };
  if (hidden) return { status: 'hidden' as const };
  return {
    status: 'visible' as const,
    attemptId: result.attemptId,
    submittedAt: result.submittedAt.toISOString(),
    podium: result.podium,
  };
}

/** La lesión de un jugador (2026-10-24), como la ve el cuerpo técnico. */
export function injuryView(player: { injuredAt: Date | null; injuryReturnOn: string | null }) {
  return player.injuredAt
    ? { since: player.injuredAt.toISOString(), returnOn: player.injuryReturnOn }
    : null;
}
