import type { ComponentProps, ReactNode } from 'react';
import { Link } from 'react-router';

import styles from './IconButton.module.css';

type Variant = 'surface' | 'sunken' | 'brand' | 'accent' | 'dark';

interface Common {
  /** Lo que hace, para lectores de pantalla: "Notificaciones", "Volver". */
  label: string;
  icon: ReactNode;
  variant?: Variant;
  /** Un globo rojo con un número (avisos sin leer). */
  badge?: number;
}

/**
 * Botón redondo de solo icono, para la barra de arriba: volver, campana, invitar. Con `to` es un
 * enlace (lleva a otra pantalla); sin `to`, un botón.
 */
export function IconButton({
  label,
  icon,
  variant = 'surface',
  badge,
  to,
  ...props
}: Common & ({ to: string } | ({ to?: undefined } & Omit<ComponentProps<'button'>, 'children'>))) {
  const className = [styles.button, styles[variant]].join(' ');
  const content = (
    <>
      {icon}
      {badge ? (
        <span className={styles.badge} aria-hidden="true">
          {badge > 9 ? '9+' : badge}
        </span>
      ) : null}
    </>
  );
  const name = badge ? `${label} (${badge})` : label;
  if (to) {
    return (
      <Link to={to} className={className} aria-label={name}>
        {content}
      </Link>
    );
  }
  return (
    <button type="button" {...props} className={className} aria-label={name}>
      {content}
    </button>
  );
}
