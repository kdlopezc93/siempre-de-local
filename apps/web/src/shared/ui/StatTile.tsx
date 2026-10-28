import type { ReactNode } from 'react';

import styles from './StatTile.module.css';

export type StatTileTone = 'white' | 'sunken' | 'brand' | 'ink' | 'volt' | 'coral' | 'sun';

/**
 * Un dato de un vistazo: la etiqueta arriba y la cifra grande (Partidos 12, Goles 4). Se ponen
 * de a 2–4 en una grilla. `delta` es el cambio ("+2"), en verde si sube y rojo si baja.
 */
export function StatTile({
  label,
  value,
  unit,
  delta,
  icon,
  tone = 'white',
  align = 'center',
}: {
  label: ReactNode;
  value: ReactNode;
  unit?: string;
  delta?: string;
  icon?: ReactNode;
  tone?: StatTileTone;
  align?: 'center' | 'start';
}) {
  const down = delta?.trim().startsWith('-') || delta?.trim().startsWith('−');
  return (
    <div className={[styles.tile, styles[tone], styles[align]].join(' ')}>
      <dt className={styles.label}>
        {icon}
        {label}
      </dt>
      <dd className={styles.value}>
        <span className={styles.number}>{value}</span>
        {unit && <span className={styles.unit}>{unit}</span>}
      </dd>
      {delta && <dd className={down ? styles.down : styles.up}>{delta}</dd>}
    </div>
  );
}

/** La grilla de StatTile: una lista de definiciones (etiqueta → cifra) para el lector. */
export function StatGrid({ columns = 3, children }: { columns?: 2 | 3 | 4; children: ReactNode }) {
  return (
    <dl
      className={styles.grid}
      style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
    >
      {children}
    </dl>
  );
}
