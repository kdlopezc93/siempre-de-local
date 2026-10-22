import type { PlayerProfileResponse, SquadPlayer } from '@sdl/contracts';

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
