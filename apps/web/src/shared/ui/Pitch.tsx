import type { MatchFormat, PositionCode } from '@sdl/contracts';
import { ELIGIBLE_POSITIONS, PITCH_LAYOUT, POSITIONS } from '@sdl/domain';

import styles from './Pitch.module.css';

interface PitchProps {
  format: MatchFormat;
  /** Posiciones a marcar, en orden: la primera se destaca; las demás llevan aro. */
  marked: readonly PositionCode[];
  /** Descripción para lectores de pantalla. */
  label: string;
}

/**
 * La pizarra: única fuente de la cancha (docs/design-system.md §9), con las coordenadas de
 * @sdl/domain (viewBox 100×150, portería propia abajo).
 */
export function Pitch({ format, marked, label }: PitchProps) {
  const layout = PITCH_LAYOUT[format];
  return (
    <svg viewBox="0 0 100 150" className={styles.pitch} role="img" aria-label={label}>
      <g className={styles.lines}>
        <rect x="3" y="3" width="94" height="144" />
        <line x1="3" y1="75" x2="97" y2="75" />
        <circle cx="50" cy="75" r="11" />
        <rect x="26" y="126" width="48" height="21" />
        <rect x="38" y="140" width="24" height="7" />
        <rect x="26" y="3" width="48" height="21" />
        <rect x="38" y="3" width="24" height="7" />
      </g>
      <circle cx="50" cy="75" r="1.2" className={styles.spot} />

      {ELIGIBLE_POSITIONS[format].map((pos) => {
        const [x, y] = layout[pos]!;
        const rank = marked.indexOf(pos);
        const className = rank === 0 ? styles.first : rank > 0 ? styles.podium : styles.marker;
        return (
          <g key={pos} className={className}>
            {rank === 0 && <circle cx={x} cy={y} r="8.5" className={styles.halo} />}
            <circle cx={x} cy={y} r="5.4" className={styles.dot} />
            <text x={x} y={y + 2.1} className={styles.number}>
              {POSITIONS[pos].number}
            </text>
          </g>
        );
      })}
    </svg>
  );
}
