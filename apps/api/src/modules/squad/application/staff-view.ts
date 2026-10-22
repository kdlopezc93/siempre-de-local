import type { Actor } from '../../../shared/authz/policy.js';
import type { LatestResult } from './ports/squad.ports.js';

/** Coach y assistant valoran; el admin del club no (ve los resultados sin más). */
export function assessesIn(actor: Actor, teamId: string): boolean {
  const roles = actor.teams.get(teamId) ?? [];
  return roles.includes('coach') || roles.includes('assistant');
}

/**
 * Qué ve del test quien pregunta. Quien valora no lo ve hasta haber valorado al jugador:
 * así su primera valoración es a ciegas (06 · Fase 3).
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
