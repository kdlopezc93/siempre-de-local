import type { PlayerProfileResponse, PositionCode, SquadPlayer } from '@sdl/contracts';

/**
 * ¿El test coincide con el cuerpo técnico? Compara la principal de la última valoración con
 * el podio del test. null si falta alguno de los dos (o el test no se ve todavía).
 */
export function agreement(profile: PlayerProfileResponse): 'match' | 'differs' | null {
  const latest = profile.assessments[0];
  if (!latest || profile.test.status !== 'visible') return null;
  return profile.test.podium.includes(latest.primaryPosition) ? 'match' : 'differs';
}

/**
 * Quiénes más del equipo usan ese dorsal. Repetir se permite (dos pueden compartir
 * camiseta), pero se avisa para que sea a propósito.
 */
export function jerseyHolders(
  players: readonly SquadPlayer[],
  jerseyNumber: number,
  exceptUserId: string,
): string[] {
  return players
    .filter((p) => p.jerseyNumber === jerseyNumber && p.userId !== exceptUserId)
    .map((p) => p.displayName);
}

/** La posición con la que se muestra en su ficha: cuerpo técnico, si no test, si no la que prefiere. */
export function sheetPosition(profile: PlayerProfileResponse): PositionCode | null {
  return (
    profile.assessments[0]?.primaryPosition ??
    (profile.test.status === 'visible' ? profile.test.podium[0] : undefined) ??
    profile.player.preferredPositions[0] ??
    null
  );
}

/** Su mejor puntaje de conocimiento en cualquier posición, o null sin exámenes. */
export function bestKnowledge(
  profile: PlayerProfileResponse,
): { position: PositionCode; pct: number } | null {
  let best: { position: PositionCode; pct: number } | null = null;
  for (const p of profile.knowledge.positions) {
    if (p.best && (!best || p.best.pct > best.pct))
      best = { position: p.position, pct: p.best.pct };
  }
  return best;
}
