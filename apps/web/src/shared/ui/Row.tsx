import { CaretRight } from '@phosphor-icons/react/dist/csr/CaretRight';
import type { ReactNode } from 'react';
import { Link } from 'react-router';

import styles from './Row.module.css';

/**
 * Una fila de lista que lleva a otra pantalla: algo a la izquierda (una ficha, un icono), el
 * título y una línea corta debajo, y a la derecha un dato (una media, un estado).
 */
export function Row({
  to,
  leading,
  title,
  meta,
  trailing,
}: {
  to: string;
  leading?: ReactNode;
  title: ReactNode;
  meta?: ReactNode;
  trailing?: ReactNode;
}) {
  return (
    <Link to={to} className={styles.row}>
      {leading}
      <span className={styles.main}>
        <span className={styles.title}>{title}</span>
        {meta && <span className={styles.meta}>{meta}</span>}
      </span>
      {trailing && <span className={styles.trailing}>{trailing}</span>}
      <CaretRight size={18} className={styles.caret} aria-hidden="true" />
    </Link>
  );
}
