import type { Breakdown, Signal } from '@sdl/domain';

import styles from './PlannerPage.module.css';

const SIGNALS: { key: Signal; label: string }[] = [
  { key: 'V', label: 'Cuerpo técnico' },
  { key: 'R', label: 'Tarjeta' },
  { key: 'C', label: 'Conocimiento' },
  { key: 'A', label: 'Test' },
];

/** Por qué un jugador encaja en un puesto: cuánto aporta cada fuente, o "sin dato". */
export function SlotBreakdown({ breakdown }: { breakdown: Breakdown | null }) {
  return (
    <ul className={styles.breakdown}>
      {SIGNALS.map(({ key, label }) => {
        const v = breakdown?.[key];
        return (
          <li key={key}>
            <span>{label}</span>
            <span className={styles.bar} aria-hidden="true">
              <span style={{ transform: `scaleX(${v ?? 0})` }} />
            </span>
            <span className={styles.value}>
              {v === undefined ? 'sin dato' : `${Math.round(v * 100)}%`}
            </span>
          </li>
        );
      })}
    </ul>
  );
}
