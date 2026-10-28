import type { ReactNode, Ref } from 'react';

import styles from './PageTitle.module.css';

/**
 * El título de pantalla del sistema (TopBar grande): dos pesos, una línea liviana de contexto y
 * el tema en negrita ("Hola, Kevin / **Tu equipo**"). A la derecha, botones redondos de icono.
 * El h1 es el título completo, así el lector de pantalla lee las dos líneas juntas.
 */
export function PageTitle({
  eyebrow,
  title,
  subtitle,
  actions,
  headingRef,
}: {
  /** La línea liviana de arriba: "Hola, Kevin", "Hoy", "Mis". */
  eyebrow?: ReactNode;
  title: ReactNode;
  /** Una línea chica debajo: "Lunes 27 de octubre", "7 inscritos". */
  subtitle?: ReactNode;
  actions?: ReactNode;
  headingRef?: Ref<HTMLHeadingElement>;
}) {
  return (
    <header className={styles.header}>
      <div className={styles.text}>
        <h1 ref={headingRef} tabIndex={headingRef ? -1 : undefined} className={styles.title}>
          {eyebrow && <span className={styles.eyebrow}>{eyebrow} </span>}
          <span className={styles.subject}>{title}</span>
        </h1>
        {subtitle && <p className={styles.subtitle}>{subtitle}</p>}
      </div>
      {actions && <div className={styles.actions}>{actions}</div>}
    </header>
  );
}
