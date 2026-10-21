import type { ReactNode } from 'react';
import { Navigate } from 'react-router';

import type { CurrentUser } from '../../shared/api/auth';

import { Button } from '../../shared/ui/Button';
import { Screen } from '../../shared/ui/Screen';
import { HomePage } from '../home/HomePage';
import { SpikePwaPage } from '../spike-pwa/SpikePwaPage';
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

/** Exige sesión; sin ella manda a /entrar. */
function RequireSession({ children }: { children: (user: CurrentUser) => ReactNode }) {
  const session = useSession();
  if (session.isPending) return <SessionPending />;
  if (session.isError) return <SessionError retry={() => void session.refetch()} />;
  if (!session.data) return <Navigate to="/entrar" replace />;
  return children(session.data);
}

/** "/" */
export function HomeRoute() {
  return <RequireSession>{(user) => <HomePage user={user} />}</RequireSession>;
}

/** "/prueba-pwa" — TEMPORAL, spike PWA (docs/spikes/pwa.md). */
export function SpikePwaRoute() {
  return <RequireSession>{(user) => <SpikePwaPage user={user} />}</RequireSession>;
}

/** "/entrar" — si ya hay sesión, vuelve al inicio. */
export function LoginRoute() {
  const session = useSession();
  if (session.isPending) return <SessionPending />;
  if (session.data) return <Navigate to="/" replace />;
  return <LoginPage />;
}
