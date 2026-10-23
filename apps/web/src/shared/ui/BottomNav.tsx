import type { Icon } from '@phosphor-icons/react';
import { NavLink } from 'react-router';

import styles from './BottomNav.module.css';

export interface NavItem {
  to: string;
  label: string;
  icon: Icon;
  /** Pendientes de esa pestaña (se muestra el número; 0 o nada, sin globo). */
  badge?: number;
  end?: boolean;
}

/**
 * La barra de abajo: las pestañas principales del rol en el equipo activo (máximo 5), con
 * icono y nombre. La activa se rellena y lleva el punto ámbar del icono de la app.
 */
export function BottomNav({ items }: { items: readonly NavItem[] }) {
  return (
    <nav aria-label="Principal" className={styles.nav}>
      <ul className={styles.list}>
        {items.map(({ to, label, icon: Glyph, badge, end }) => (
          <li key={to}>
            <NavLink to={to} end={end ?? false} className={styles.item ?? ''}>
              {({ isActive }) => (
                <>
                  <span className={styles.icon}>
                    <Glyph size={24} weight={isActive ? 'fill' : 'regular'} aria-hidden="true" />
                    {badge ? (
                      <span className={styles.badge}>
                        {badge > 9 ? '9+' : badge}
                        <span className="sr-only"> pendientes</span>
                      </span>
                    ) : null}
                  </span>
                  <span className={styles.label}>{label}</span>
                </>
              )}
            </NavLink>
          </li>
        ))}
      </ul>
    </nav>
  );
}
