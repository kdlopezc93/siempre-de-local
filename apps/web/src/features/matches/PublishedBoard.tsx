import type { PublishedLineupResponse } from '@sdl/contracts';
import { findFormation } from '@sdl/domain';

import { PitchLines } from '../../shared/ui/PitchLines';
import { lineOfPosition } from '../../shared/ui/Token';
import { slotName } from './match-view';
import styles from './PublishedBoard.module.css';

const short = (name: string) => (name.length > 11 ? `${name.split(' ')[0]!.slice(0, 11)}` : name);

/**
 * La alineación publicada, para mirar (D17): cada titular en su puesto con su dorsal y el aro
 * del color de su línea; quien la mira, en ámbar. Sin encaje ni nada que tocar.
 */
export function PublishedBoard({
  lineup,
  meId,
}: {
  lineup: PublishedLineupResponse;
  meId: string;
}) {
  const formation = findFormation(lineup.formation);
  if (!formation) return null;
  const at = new Map(lineup.starters.map((s) => [s.slotId, s.player]));
  const describe = formation.slots
    .map((slot) => {
      const player = at.get(slot.id);
      return `${slotName(slot)}: ${player?.displayName ?? 'vacío'}`;
    })
    .join('; ');
  return (
    <svg
      viewBox="0 0 100 150"
      className={styles.board}
      role="img"
      aria-label={`Alineación ${formation.label}. ${describe}`}
    >
      <PitchLines />
      {formation.slots.map((slot) => {
        const player = at.get(slot.id) ?? null;
        const [x, y] = slot.coord;
        const mine = player?.id === meId;
        return (
          <g
            key={slot.id}
            className={[
              styles.slot,
              styles[lineOfPosition(slot.position)],
              mine ? styles.me : '',
            ].join(' ')}
          >
            <circle cx={x} cy={y} r="6" className={styles.dot} />
            <text x={x} y={y + 1.6} className={styles.code}>
              {player ? (player.jerseyNumber ?? player.displayName.slice(0, 2).toUpperCase()) : '–'}
            </text>
            <text x={x} y={y + 10.5} className={styles.name}>
              {player ? short(player.displayName) : 'vacío'}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
