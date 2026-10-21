import { Navigate } from 'react-router';

import { Button } from '../../shared/ui/Button';
import { Screen } from '../../shared/ui/Screen';
import { HomePage } from '../home/HomePage';
import { LoginPage } from './LoginPage';
import { useSession } from './use-session';

function SessionPending() {
  return (
    <Screen>
      <p className="sr-only" role="status">
        Cargando…
      </p>
    </Screen>
  );
}

function SessionError({ retry }: { retry: () => void }) {
  return (
    <Screen>
      <p role="alert">No pudimos conectar con el servidor. Revisa tu conexión.</p>
      <Button variant="secondary" onClick={retry}>
        Intentar de nuevo
      </Button>
    </Screen>
  );
}

/** "/" — exige sesión; sin ella manda a /entrar. */
export function HomeRoute() {
  const session = useSession();
  if (session.isPending) return <SessionPending />;
  if (session.isError) return <SessionError retry={() => void session.refetch()} />;
  if (!session.data) return <Navigate to="/entrar" replace />;
  return <HomePage user={session.data} />;
}

/** "/entrar" — si ya hay sesión, vuelve al inicio. */
export function LoginRoute() {
  const session = useSession();
  if (session.isPending) return <SessionPending />;
  if (session.data) return <Navigate to="/" replace />;
  return <LoginPage />;
}
