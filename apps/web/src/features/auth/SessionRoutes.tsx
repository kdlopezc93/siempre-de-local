import type { ReactNode } from 'react';
import { Navigate, useParams } from 'react-router';

import type { Me } from '../../shared/api/auth';

import { Button } from '../../shared/ui/Button';
import { Screen } from '../../shared/ui/Screen';
import { HomePage } from '../home/HomePage';
import { JoinPage } from '../join/JoinPage';
import { useInvitationPreview } from '../join/use-join';
import { ConsentPage } from '../onboarding/ConsentPage';
import { NoTeamPage } from '../onboarding/NoTeamPage';
import { HistoryPage } from '../history/HistoryPage';
import { ProfilePage } from '../player-profile/ProfilePage';
import { QuizPage } from '../quiz/QuizPage';
import { ResultPage } from '../result/ResultPage';
import { SciencePage } from '../science/SciencePage';
import { InvitePage } from '../team-admin/InvitePage';
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

/**
 * Exige sesión (sin ella, a /entrar), la política vigente aceptada y pertenecer a algún
 * equipo o club (04 §1.2: no hay registro abierto).
 */
function RequireSession({ children }: { children: (me: Me) => ReactNode }) {
  const session = useSession();
  if (session.isPending) return <SessionPending />;
  if (session.isError) return <SessionError retry={() => void session.refetch()} />;
  const me = session.data;
  if (!me) return <Navigate to="/entrar" replace />;
  if (!me.consent) return <ConsentPage />;
  if (me.teams.length === 0 && me.clubs.length === 0) return <NoTeamPage email={me.user.email} />;
  return children(me);
}

/** "/" */
export function HomeRoute() {
  return <RequireSession>{(me) => <HomePage me={me} />}</RequireSession>;
}

/** "/entrar" — si ya hay sesión, vuelve al inicio. */
export function LoginRoute() {
  const session = useSession();
  if (session.isPending) return <SessionPending />;
  if (session.data) return <Navigate to="/" replace />;
  return <LoginPage />;
}

/** "/unirse/:code" — funciona con o sin sesión; la página guía cada paso. */
export function JoinRoute() {
  const { code = '' } = useParams();
  // En paralelo con la sesión: son independientes y JoinPage reutiliza esta consulta.
  useInvitationPreview(code);
  const session = useSession();
  if (session.isPending) return <SessionPending />;
  if (session.isError) return <SessionError retry={() => void session.refetch()} />;
  return <JoinPage code={code} me={session.data} />;
}

/** "/equipos/:teamId/invitar" — el API decide si puede (coach o admin del club). */
export function InviteRoute() {
  const { teamId = '' } = useParams();
  return <RequireSession>{() => <InvitePage teamId={teamId} />}</RequireSession>;
}

/** "/equipos/:teamId/test" — el test de orientación del jugador. */
export function QuizRoute() {
  const { teamId = '' } = useParams();
  return <RequireSession>{(me) => <QuizPage me={me} teamId={teamId} />}</RequireSession>;
}

/** "/resultados/:attemptId" — un resultado oficial guardado. */
export function ResultRoute() {
  const { attemptId = '' } = useParams();
  return <RequireSession>{() => <ResultPage attemptId={attemptId} />}</RequireSession>;
}

/** "/historial" — mis tests. */
export function HistoryRoute() {
  return <RequireSession>{(me) => <HistoryPage me={me} />}</RequireSession>;
}

/** "/bases" — en qué se basa el test. */
export function ScienceRoute() {
  return <RequireSession>{() => <SciencePage />}</RequireSession>;
}

/** "/perfil" — el perfil propio. */
export function ProfileRoute() {
  return <RequireSession>{(me) => <ProfilePage me={me} />}</RequireSession>;
}
