import type { Icon } from '@phosphor-icons/react';
import { ArrowRight } from '@phosphor-icons/react/dist/csr/ArrowRight';
import { Link } from 'react-router';

import styles from './TaskCard.module.css';

/**
 * "Lo que toca" en el inicio. La primera es el bloque cobalto (lo más importante de la pantalla);
 * las demás, filas tranquilas con su icono y, si aplica, cuántos.
 */
export function LeadTask({ to, title, detail }: { to: string; title: string; detail?: string }) {
  return (
    <Link to={to} className={styles.lead}>
      <span className={styles.leadText}>
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
}: {
  to: string;
  icon: Icon;
  title: string;
  count?: number;
}) {
  return (
    <Link to={to} className={styles.row}>
      <span className={styles.rowIcon} aria-hidden="true">
        <Glyph size={22} />
      </span>
      <span className={styles.rowTitle}>{title}</span>
      {count !== undefined && <span className={styles.count}>{count}</span>}
    </Link>
  );
}
