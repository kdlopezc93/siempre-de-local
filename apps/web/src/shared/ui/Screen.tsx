import type { ReactNode } from 'react';

import styles from './Screen.module.css';

/** Contenedor de pantalla: una columna centrada, con márgenes de zona segura. */
export function Screen({
  children,
  className,
}: {
  children: ReactNode;
  className?: string | undefined;
}) {
  return (
    <main
      id="contenido"
      tabIndex={-1}
      className={[styles.screen, className].filter(Boolean).join(' ')}
    >
      {children}
    </main>
  );
}
