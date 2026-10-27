import type { MatchFormat, PositionCode } from '@sdl/contracts';
import { ELIGIBLE_POSITIONS, PITCH_LAYOUT, POSITIONS } from '@sdl/domain';

import styles from './Pitch.module.css';
import { PitchLines } from './PitchLines';

interface PitchProps {
  format: MatchFormat;
  /** Posiciones a marcar, en orden: la primera se destaca; las demás llevan aro. */
  marked?: readonly PositionCode[];
  /**
   * Modo plantilla (como el planificador del prototipo): la sigla en el círculo y debajo
   * quién juega ahí ("Ana +2"). Sin nadie es un hueco, con aro volt punteado.
   */
  roster?: Partial<Record<PositionCode, readonly string[]>>;
  /** Descripción para lectores de pantalla. */
  label: string;
}

/**
 * La pizarra: única fuente de la cancha (docs/design-system.md §9), con las coordenadas de
 * @sdl/domain (viewBox 100×150, portería propia abajo).
 */
export function Pitch({ format, marked = [], roster, label }: PitchProps) {
  const layout = PITCH_LAYOUT[format];
  return (
    <svg viewBox="0 0 100 150" className={styles.pitch} role="img" aria-label={label}>
      <PitchLines />

      {ELIGIBLE_POSITIONS[format].map((pos) => {
        const [x, y] = layout[pos]!;
        if (roster) {
          const names = roster[pos] ?? [];
          return (
            <g key={pos} className={names.length ? styles.filled : styles.gap}>
              <circle cx={x} cy={y} r="6" className={styles.dot} />
              <text x={x} y={y + 1.3} className={styles.code}>
                {pos}
              </text>
              <text x={x} y={y + 10} className={styles.name}>
                {names.length === 0
                  ? 'hueco'
                  : `${short(names[0]!)}${names.length > 1 ? ` +${names.length - 1}` : ''}`}
              </text>
            </g>
          );
        }
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

/** Nombres largos se cortan para no pisar la posición de al lado. */
function short(name: string): string {
  const first = name.split(' ')[0] ?? name;
  return first.length > 9 ? `${first.slice(0, 8)}…` : first;
}
