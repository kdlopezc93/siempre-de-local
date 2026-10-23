import type { Icon } from '@phosphor-icons/react';
import { Link } from 'react-router';

import styles from './BottomNav.module.css';

export interface NavItem {
  to: string;
  label: string;
  icon: Icon;
  /** Pendientes de esa pestaña (se muestra el número; 0 o nada, sin globo). */
  badge?: number;
}

/**
 * La barra de abajo: las pestañas principales del rol en el equipo activo (máximo 5), con
 * icono y nombre. La activa (`current`, el `to` de su pestaña: una pestaña cubre varias
 * pantallas) se rellena y lleva el punto ámbar del icono de la app.
 */
export function BottomNav({
  items,
  current,
}: {
  items: readonly NavItem[];
  current: string | undefined;
}) {
  return (
    <nav aria-label="Principal" className={styles.nav}>
      <ul className={styles.list}>
        {items.map(({ to, label, icon: Glyph, badge }) => {
          const active = to === current;
          return (
            <li key={to}>
              <Link to={to} className={styles.item} aria-current={active ? 'page' : undefined}>
                <span className={styles.icon}>
                  <Glyph size={24} weight={active ? 'fill' : 'regular'} aria-hidden="true" />
                  {badge ? (
                    <span className={styles.badge}>
                      {badge > 9 ? '9+' : badge}
                      <span className="sr-only"> pendientes</span>
                    </span>
                  ) : null}
                </span>
                <span className={styles.label}>{label}</span>
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
