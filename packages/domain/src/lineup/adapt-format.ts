import { FORMAT_FOLD, type MatchFormat, type PositionCode } from '../positions.js';
import type { PlayerSignals } from './fit.js';

/**
 * Adapta las señales de un jugador al formato del partido. Un equipo puede jugar la liga
 * en F11 y un torneo en F8 o en F5: en F8 no hay pivote ni mediapunta, que cuentan como
 * mediocentro y delantero; en F5, lateral y pivote cuentan como cierre, mediocentro como ala y
 * mediapunta como pívot (igual que el plegado del test, 02 §4).
 *
 * - Test, valoración y conocimiento: en la posición plegada vale **el mejor** de los dos.
 *   (Con solo el % de cada posición no se puede rehacer el plegado exacto del test.)
 * - Tarjeta: las medias de las posiciones del formato tal cual (02 §7.3).
 * En F11 no hay nada que hacer: están todas las posiciones.
 */
export function adaptSignals<T extends PlayerSignals>(player: T, format: MatchFormat): T {
  const folds = FORMAT_FOLD[format];
  if (Object.keys(folds).length === 0) return player;
  const fold = (pos: PositionCode): PositionCode => folds[pos] ?? pos;
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
      Object.entries(player.rating).filter(([pos]) => !(pos in folds)),
    ) as Partial<Record<PositionCode, number>>);
  return {
    ...player,
    affinity: foldMax(player.affinity, (v) => v),
    assessment,
    knowledge: foldMax(player.knowledge, (k) => k.pct),
    rating,
  };
}
