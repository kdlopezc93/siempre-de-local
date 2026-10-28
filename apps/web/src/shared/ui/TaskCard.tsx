import type { Icon } from '@phosphor-icons/react';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { Link } from 'react-router';

import styles from './TaskCard.module.css';

/**
 * "Lo que toca" en el inicio. La primera es el bloque cobalto (lo más importante de la pantalla);
 * las demás, filas tranquilas con su icono y, si aplica, cuántos.
 */
export function LeadTask({
  to,
  title,
  detail,
  overline = 'Lo que toca',
}: {
  to: string;
  title: string;
  detail?: string;
  /** El sobretítulo del bloque (mayúsculas de 11px). */
  overline?: string;
}) {
  return (
    <Link to={to} className={styles.lead}>
      <span className={styles.leadText}>
        <span className={styles.leadOverline}>{overline}</span>
        <span className={styles.leadTitle}>{title}</span>
        {detail && <span className={styles.leadDetail}>{detail}</span>}
      </span>
      <span className={styles.leadGo} aria-hidden="true">
        <ArrowRight size={22} weight="bold" />
      </span>
    </Link>
  );
}

export function TaskRow({
  to,
  icon: Glyph,
  title,
  count,
  tint = 6,
}: {
  to: string;
  icon: Icon;
  title: string;
  count?: number;
  /** El color del mosaico del icono (los tintes del sistema, 1–6). */
  tint?: 1 | 2 | 3 | 4 | 5 | 6;
}) {
  return (
    <Link to={to} className={styles.row}>
      <span className={styles.rowIcon} data-tint={tint} aria-hidden="true">
        <Glyph size={22} />
      </span>
      <span className={styles.rowTitle}>{title}</span>
      {count !== undefined && <span className={styles.count}>{count}</span>}
    </Link>
  );
}
