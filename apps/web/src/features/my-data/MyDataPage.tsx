import { Link, useSearchParams } from 'react-router';

import { Screen } from '../../shared/ui/Screen';
import { PolicyText } from '../consent/PolicyText';
import styles from './MyDataPage.module.css';

/**
 * /tus-datos — pública, sin sesión (07 §4.5): qué guardamos y cómo eliminar la cuenta. Google
 * la pide para publicar el inicio de sesión. Solo dice lo que la app hace de verdad.
 */
export function MyDataPage({ signedIn }: { signedIn: boolean }) {
  const [params] = useSearchParams();
  const deleted = params.get('cuenta') === 'eliminada';
  return (
    <Screen className={styles.screen}>
      {deleted && (
        <p role="status" className={styles.done}>
          Tu cuenta y tus datos fueron eliminados.
        </p>
      )}
      <header>
        <h1 className={styles.title}>Tus datos</h1>
        <p className={styles.lead}>Qué guardamos de ti en Siempre de Local y cómo eliminarlo.</p>
      </header>

      <section aria-labelledby="que" className={styles.section}>
        <h2 id="que" className={styles.sectionTitle}>
          Qué guardamos
        </h2>
        <ul className={styles.list}>
          <li>Tu nombre y tu correo de Google. Nada más de tu cuenta de Google.</li>
          <li>Tu perfil: cómo te dicen, tu pie y las posiciones que prefieres.</li>
          <li>Tus respuestas y resultados del test de posición y de los exámenes.</li>
          <li>Lo que el cuerpo técnico registra sobre ti: tu tarjeta, sus valoraciones y notas.</li>
          <li>Tus equipos y tu rol en cada uno, y cuándo aceptaste la política de datos.</li>
        </ul>
      </section>

      <section aria-labelledby="como" className={styles.section}>
        <h2 id="como" className={styles.sectionTitle}>
          Cómo eliminar tu cuenta
        </h2>
        <ol className={styles.list}>
          <li>Entra a la app.</li>
          <li>Toca tu ficha, arriba a la derecha: abre Tu cuenta.</li>
          <li>Toca "Eliminar mi cuenta" y escribe ELIMINAR para confirmar.</li>
        </ol>
        <p>
          Se borra en el momento: tu perfil, tus tests, tus exámenes, tu tarjeta, lo que el cuerpo
          técnico registró sobre ti, tu lugar en tus equipos y tus sesiones.
        </p>
        <p className={styles.muted}>
          Lo que hiciste sobre otros (valoraciones, tarjetas que puntuaste, alineaciones) queda en
          su equipo sin tu nombre. Antes de eliminarla puedes descargar tus datos desde Tu cuenta.
        </p>
        <p className={styles.muted}>
          Si ya no puedes entrar, escribe al contacto de la política de datos y la eliminamos por
          ti.
        </p>
      </section>

      <details className={styles.policy}>
        <summary>Leer la política de tratamiento de datos</summary>
        <PolicyText />
      </details>

      <Link to={signedIn ? '/cuenta' : '/entrar'} className={styles.back}>
        {signedIn ? 'Ir a tu cuenta' : 'Entrar'}
      </Link>
    </Screen>
  );
}
