import type { PlayerProfileResponse } from '@sdl/contracts';

/**
 * ¿El test coincide con el cuerpo técnico? Compara la principal de la última valoración con
 * el podio del test. null si falta alguno de los dos (o el test no se ve todavía).
 */
export function agreement(profile: PlayerProfileResponse): 'match' | 'differs' | null {
  const latest = profile.assessments[0];
  if (!latest || profile.test.status !== 'visible') return null;
  return profile.test.podium.includes(latest.primaryPosition) ? 'match' : 'differs';
}
