/**
 * Por qué no puedes valorar a alguien de la plantilla (04 §2.2): el API decide con `canRate`;
 * aquí solo va el texto. Nadie se valora a sí mismo, y a los asistentes los valora el
 * entrenador.
 */
export function whyCannotRate(playerId: string, myUserId: string | undefined): string {
  return playerId === myUserId
    ? 'No te puedes valorar a ti mismo.'
    : 'A los asistentes los valora el entrenador.';
}
