import { useSearchParams } from 'react-router';

import { Button } from '../../shared/ui/Button';
import { Screen } from '../../shared/ui/Screen';
import { ChalkPlay } from './components/ChalkPlay';
import { GoogleMark } from './components/GoogleMark';
import styles from './LoginPage.module.css';
import { useGoogleSignIn } from './use-session';

export function LoginPage() {
  const [params] = useSearchParams();
  const signIn = useGoogleSignIn();

  const error = signIn.isError
    ? 'No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.'
    : params.has('error')
      ? 'Google no completó el inicio de sesión. Intenta de nuevo; si vuelve a pasar, avísale a tu entrenador.'
      : null;

  return (
    <Screen>
      <div className={styles.board}>
        <ChalkPlay />
      </div>

      <div className={styles.copy}>
        <h1 className={styles.title}>Tu equipo, siempre de local</h1>
        <p className={styles.lead}>Entra para hacer tu test de posición y seguir a tu equipo.</p>

        <div className={styles.actions}>
          {error && (
            <p role="alert" className={styles.alert}>
              {error}
            </p>
          )}
          <Button busy={signIn.isPending || signIn.isSuccess} onClick={() => signIn.mutate()}>
            <span className={styles.googleBadge}>
              <GoogleMark size={18} />
            </span>
            {signIn.isPending || signIn.isSuccess ? 'Abriendo Google…' : 'Continuar con Google'}
          </Button>
          <p className={styles.note}>Solo usamos tu nombre y tu correo de Google.</p>
        </div>
      </div>
    </Screen>
  );
}
