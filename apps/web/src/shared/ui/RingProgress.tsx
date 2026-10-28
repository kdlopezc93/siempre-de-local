import type { ReactNode } from 'react';

import styles from './RingProgress.module.css';

/**
 * Anillo de avance (meta semanal, asistencia, conocimiento). Puntas redondas; en el centro el
 * valor en Space Grotesk o lo que se pase como hijos. Decorativo: quien lo usa dice el dato en
 * texto al lado.
 */
export function RingProgress({
  value,
  max = 100,
  size = 96,
  stroke = 10,
  tone = 'brand',
  label,
  sublabel,
  children,
}: {
  value: number;
  max?: number;
  size?: number;
  stroke?: number;
  tone?: 'brand' | 'accent' | 'ink' | 'white';
  label?: string;
  sublabel?: string;
  children?: ReactNode;
}) {
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  const fraction = Math.max(0, Math.min(1, max ? value / max : 0));
  return (
    <div
      className={[styles.ring, styles[tone]].join(' ')}
      style={{ width: size, height: size }}
      aria-hidden="true"
    >
      <svg width={size} height={size} className={styles.svg}>
        <circle className={styles.track} cx={size / 2} cy={size / 2} r={r} strokeWidth={stroke} />
        <circle
          className={styles.fill}
          cx={size / 2}
          cy={size / 2}
          r={r}
          strokeWidth={stroke}
          strokeDasharray={c}
          strokeDashoffset={c * (1 - fraction)}
        />
      </svg>
      <div className={styles.center}>
        {children ?? (
          <>
            <span className={styles.label} style={{ fontSize: Math.round(size * 0.22) }}>
              {label}
            </span>
            {sublabel && <span className={styles.sublabel}>{sublabel}</span>}
          </>
        )}
      </div>
    </div>
  );
}
