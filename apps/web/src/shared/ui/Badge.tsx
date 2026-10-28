import type { ReactNode } from 'react';

import styles from './Badge.module.css';

export type BadgeTone =
  'success' | 'warning' | 'danger' | 'brand' | 'neutral' | 'accent' | 'inverse' | 'white' | 'live';

/**
 * Insignia del sistema: una píldora chica en mayúsculas para un estado ("Al día", "Pendiente",
 * "En vivo") o un dato corto ("Racha 7 días"). Siempre con la palabra: el color nunca va solo.
 */
export function Badge({
  tone = 'neutral',
  size = 'md',
  dot = false,
  children,
}: {
  tone?: BadgeTone;
  size?: 'sm' | 'md';
  /** Un punto antes del texto (EN VIVO). */
  dot?: boolean;
  children: ReactNode;
}) {
  return (
    <span className={[styles.badge, styles[tone], styles[size]].join(' ')}>
      {dot && <span className={styles.dot} aria-hidden="true" />}
      {children}
    </span>
  );
}
