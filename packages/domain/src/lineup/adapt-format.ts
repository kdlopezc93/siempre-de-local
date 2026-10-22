import { F8_FOLD, type MatchFormat, type PositionCode } from '../positions.js';
import type { PlayerSignals } from './fit.js';

/**
 * Adapta las señales de un jugador al formato del partido. Un equipo puede jugar la liga
 * en F11 y un torneo en F8: en F8 no hay pivote ni mediapunta, que cuentan como
 * mediocentro y delantero (igual que el plegado del test, 02 §4).
 *
 * - Test, valoración y conocimiento: en la posición plegada vale **el mejor** de los dos.
 *   (Con solo el % de cada posición no se puede rehacer el plegado exacto del test.)
 * - Tarjeta: sus medias de mediocentro y delantero tal cual (02 §7.3).
 * De F8 a F11 no hay nada que hacer: lo que falta (pivote, mediapunta) se excluye solo.
 */
export function adaptSignals<T extends PlayerSignals>(player: T, format: MatchFormat): T {
  if (format !== 'F8') return player;
  const fold = (pos: PositionCode): PositionCode => F8_FOLD[pos] ?? pos;
  const foldMax = <V>(
    record: Partial<Record<PositionCode, V>> | undefined,
    value: (v: V) => number,
  ): Partial<Record<PositionCode, V>> | undefined => {
    if (!record) return record;
    const out: Partial<Record<PositionCode, V>> = {};
    for (const [pos, v] of Object.entries(record) as [PositionCode, V][]) {
      const to = fold(pos);
      const current = out[to];
      if (current === undefined || value(v) > value(current)) out[to] = v;
    }
    return out;
  };
  const assessment = player.assessment && {
    primary: fold(player.assessment.primary),
    secondary: [...new Set(player.assessment.secondary.map(fold))].filter(
      (pos) => pos !== fold(player.assessment!.primary),
    ),
  };
  const rating =
    player.rating &&
    (Object.fromEntries(
      Object.entries(player.rating).filter(([pos]) => !(pos in F8_FOLD)),
    ) as Partial<Record<PositionCode, number>>);
  return {
    ...player,
    affinity: foldMax(player.affinity, (v) => v),
    assessment,
    knowledge: foldMax(player.knowledge, (k) => k.pct),
    rating,
  };
}
