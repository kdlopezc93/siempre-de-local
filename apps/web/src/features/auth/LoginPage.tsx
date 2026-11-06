import { Link, useSearchParams } from 'react-router';

import { Button } from '../../shared/ui/Button';
import { Screen } from '../../shared/ui/Screen';
import { GoogleMark } from './components/GoogleMark';
import { HeroPlay } from './components/HeroPlay';
import styles from './LoginPage.module.css';
import { loginPath, safeReturn } from './return-path';
import { useGoogleSignIn } from './use-session';

export function LoginPage() {
  const [params] = useSearchParams();
  // Si venía de un enlace (el del grupo de WhatsApp), Google lo deja en esa pantalla.
  const returnTo = safeReturn(params.get('volver'));
  const signIn = useGoogleSignIn(returnTo, loginPath(returnTo));

  const error = signIn.isError
    ? 'No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.'
    : params.has('error')
      ? 'Google no completó el inicio de sesión. Intenta de nuevo; si vuelve a pasar, avísale a tu entrenador.'
      : null;

  return (
    <Screen>
      {/* Lo fuerte de la pantalla: el bloque cobalto con el nombre y una jugada. */}
      <section className={styles.hero}>
        <p className={styles.eyebrow}>Fútbol amateur</p>
        <h1 className={styles.title}>
          <span className={styles.titleLight}>Tu equipo,</span> siempre de local
        </h1>
        <HeroPlay className={styles.play} />
      </section>

      <div className={styles.copy}>
        <p className={styles.lead}>Entra para hacer tu test de posición y seguir a tu equipo.</p>

        <div className={styles.actions}>
          {error && (
            <p role="alert" className={styles.alert}>
              {error}
            </p>
          )}
          <Button
            variant="secondary"
            busy={signIn.isPending || signIn.isSuccess}
            onClick={() => signIn.mutate()}
          >
            <span className={styles.googleBadge}>
              <GoogleMark size={18} />
            </span>
            {signIn.isPending || signIn.isSuccess ? 'Abriendo Google…' : 'Continuar con Google'}
          </Button>
          <p className={styles.note}>Solo usamos tu nombre y tu correo de Google.</p>
          <Link to="/tus-datos" className={styles.dataLink}>
            Tus datos y cómo eliminarlos
          </Link>
        </div>
      </div>
    </Screen>
  );
}
