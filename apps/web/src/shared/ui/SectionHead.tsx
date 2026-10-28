import type { ReactNode } from 'react';
import { Link } from 'react-router';

import styles from './SectionHead.module.css';

/**
 * El título de una sección ("Esta temporada", "Integrantes") con, si hace falta, un enlace a la
 * derecha ("Ver todo"). Lleva 22px de aire arriba, como en el sistema.
 */
export function SectionHead({
  id,
  title,
  link,
  level = 2,
}: {
  /** Para `aria-labelledby` de la sección. */
  id?: string;
  title: ReactNode;
  link?: { to: string; label: string };
  level?: 2 | 3;
}) {
  const Heading = level === 2 ? 'h2' : 'h3';
  return (
    <div className={styles.head}>
      <Heading id={id} className={styles.title}>
        {title}
      </Heading>
      {link && (
        <Link to={link.to} className={styles.link}>
          {link.label}
        </Link>
      )}
    </div>
  );
}
