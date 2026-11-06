import styles from './TestEnvBanner.module.css';

/** El nombre del entorno de pruebas, o null en staging (2026-11-06, Kevin). */
export function testEnvironmentName(mode: string = import.meta.env.MODE): string | null {
  if (mode === 'tunnel') return 'túnel';
  if (mode === 'development') return 'local';
  return null;
}

/**
 * La franja de pruebas: volt, de lado a lado y arriba de todo, para no confundir el túnel o la
 * app local con la del equipo. En staging no sale.
 */
export function TestEnvBanner({ mode }: { mode?: string }) {
  const name = testEnvironmentName(mode);
  if (!name) return null;
  return (
    <p role="note" className={styles.banner}>
      <span className={styles.dot} aria-hidden="true" />
      Pruebas: {name}
      <span className={styles.aside}>· no es la app del equipo</span>
    </p>
  );
}
