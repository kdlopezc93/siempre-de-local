import type { AdoptionResponse } from '@sdl/contracts';

import { namesList } from '../matches/share-messages';

type Player = AdoptionResponse['players'][number];

/** Las cifras del tablero: de cuántos, cuántos entraron esta semana, con avisos, con test. */
export function adoptionSummary(players: readonly Player[]) {
  const answerable = players.filter((p) => p.repliedLast !== null);
  return {
    total: players.length,
    week: players.filter((p) => p.seen === 'week').length,
    notices: players.filter((p) => p.notices).length,
    tests: players.filter((p) => p.testDone).length,
    replied: answerable.filter((p) => p.repliedLast).length,
    answerable: answerable.length,
  };
}

/** A quién recordarle: sin avisos, sin entrar hace más de una semana y sin test. */
export function adoptionGroups(players: readonly Player[]) {
  return {
    noNotices: players.filter((p) => !p.notices),
    away: players.filter((p) => p.seen === 'older'),
    noTest: players.filter((p) => !p.testDone),
  };
}

/**
 * "Pedirles los avisos en el grupo" (2026-11-06): cómo activarlos y quiénes faltan, con el
 * enlace a Tu cuenta.
 */
export function noticesMessage(names: readonly string[], url: string): string {
  return [
    '📲 *Activen los avisos de la app* para enterarse de convocatorias, alineaciones y cobros sin estar pendientes del grupo.',
    'Es en Tu cuenta → Avisos (en iPhone, primero agréguenla al inicio).',
    `Faltan: ${namesList(names)}`,
    `👉 ${url}`,
  ].join('\n');
}
