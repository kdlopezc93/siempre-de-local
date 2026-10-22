import { lazy, Suspense, useEffect, type ReactNode } from 'react';
import { Navigate, useParams } from 'react-router';

import type { Me } from '../../shared/api/auth';
import { Button } from '../../shared/ui/Button';
import { Screen } from '../../shared/ui/Screen';
import { HomePage } from '../home/HomePage';
import { useInvitationPreview } from '../join/use-join';
import { LoginPage } from './LoginPage';
import { useSession } from './use-session';

/*
 * Al abrir la app solo bajan el inicio, el login y la puerta de sesión. Cada otra pantalla
 * es su propio archivo y baja al usarla (o antes, en ratos libres: preloadScreens). En la
 * PWA instalada el service worker ya los tiene todos, también sin señal.
 */
const screens = {
  join: () => import('../join/JoinPage'),
  consent: () => import('../onboarding/ConsentPage'),
  noTeam: () => import('../onboarding/NoTeamPage'),
  quiz: () => import('../quiz/QuizPage'),
  result: () => import('../result/ResultPage'),
  history: () => import('../history/HistoryPage'),
  science: () => import('../science/SciencePage'),
  profile: () => import('../player-profile/ProfilePage'),
  invite: () => import('../team-admin/InvitePage'),
  squad: () => import('../squad/SquadPage'),
  assess: () => import('../squad/AssessPage'),
  playerProfile: () => import('../squad/PlayerProfilePage'),
  knowledge: () => import('../knowledge/KnowledgePage'),
  exam: () => import('../knowledge/ExamPage'),
  planner: () => import('../lineup/PlannerPage'),
  lineups: () => import('../lineup/SavedLineupsPage'),
  myCard: () => import('../card/MyCardPage'),
  staffCard: () => import('../card/StaffCardPage'),
  rate: () => import('../card/RatePage'),
};

const JoinPage = lazy(() => screens.join().then((m) => ({ default: m.JoinPage })));
const ConsentPage = lazy(() => screens.consent().then((m) => ({ default: m.ConsentPage })));
const NoTeamPage = lazy(() => screens.noTeam().then((m) => ({ default: m.NoTeamPage })));
const QuizPage = lazy(() => screens.quiz().then((m) => ({ default: m.QuizPage })));
const ResultPage = lazy(() => screens.result().then((m) => ({ default: m.ResultPage })));
const HistoryPage = lazy(() => screens.history().then((m) => ({ default: m.HistoryPage })));
const SciencePage = lazy(() => screens.science().then((m) => ({ default: m.SciencePage })));
const ProfilePage = lazy(() => screens.profile().then((m) => ({ default: m.ProfilePage })));
const InvitePage = lazy(() => screens.invite().then((m) => ({ default: m.InvitePage })));
const SquadPage = lazy(() => screens.squad().then((m) => ({ default: m.SquadPage })));
const AssessPage = lazy(() => screens.assess().then((m) => ({ default: m.AssessPage })));
const PlayerProfilePage = lazy(() =>
  screens.playerProfile().then((m) => ({ default: m.PlayerProfilePage })),
);
const KnowledgePage = lazy(() => screens.knowledge().then((m) => ({ default: m.KnowledgePage })));
const ExamPage = lazy(() => screens.exam().then((m) => ({ default: m.ExamPage })));
const PlannerPage = lazy(() => screens.planner().then((m) => ({ default: m.PlannerPage })));
const SavedLineupsPage = lazy(() =>
  screens.lineups().then((m) => ({ default: m.SavedLineupsPage })),
);
const LineupViewPage = lazy(() => screens.lineups().then((m) => ({ default: m.LineupViewPage })));
const MyCardPage = lazy(() => screens.myCard().then((m) => ({ default: m.MyCardPage })));
const StaffCardPage = lazy(() => screens.staffCard().then((m) => ({ default: m.StaffCardPage })));
const RatePage = lazy(() => screens.rate().then((m) => ({ default: m.RatePage })));

/** Precarga las pantallas que se usan desde el inicio cuando el navegador está libre. */
function usePreloadScreens() {
  useEffect(() => {
    const preload = () => {
      void screens.quiz();
      void screens.result();
      void screens.history();
      void screens.profile();
    };
    // Safari no tiene requestIdleCallback: ahí basta con esperar un poco.
    if (typeof window.requestIdleCallback === 'function') {
      const id = window.requestIdleCallback(preload, { timeout: 4000 });
      return () => window.cancelIdleCallback(id);
    }
    const id = globalThis.setTimeout(preload, 2000);
    return () => globalThis.clearTimeout(id);
  }, []);
}

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
  return (
    <Suspense fallback={<SessionPending />}>
      {!me.consent ? (
        <ConsentPage />
      ) : me.teams.length === 0 && me.clubs.length === 0 ? (
        <NoTeamPage email={me.user.email} />
      ) : (
        children(me)
      )}
    </Suspense>
  );
}

/** "/" */
export function HomeRoute() {
  usePreloadScreens();
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
  return (
    <Suspense fallback={<SessionPending />}>
      <JoinPage code={code} me={session.data} />
    </Suspense>
  );
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

/** "/equipos/:teamId/plantilla" — el panel del cuerpo técnico (el API decide quién entra). */
export function SquadRoute() {
  const { teamId = '' } = useParams();
  return <RequireSession>{() => <SquadPage teamId={teamId} />}</RequireSession>;
}

/** "/equipos/:teamId/plantilla/:playerId/valorar" */
export function AssessRoute() {
  const { teamId = '', playerId = '' } = useParams();
  return (
    <RequireSession>{() => <AssessPage teamId={teamId} playerId={playerId} />}</RequireSession>
  );
}

/** "/equipos/:teamId/tarjeta" — la tarjeta del propio jugador. */
export function MyCardRoute() {
  const { teamId = '' } = useParams();
  return <RequireSession>{(me) => <MyCardPage me={me} teamId={teamId} />}</RequireSession>;
}

/** "/equipos/:teamId/plantilla/:playerId/tarjeta" */
export function StaffCardRoute() {
  const { teamId = '', playerId = '' } = useParams();
  return (
    <RequireSession>{() => <StaffCardPage teamId={teamId} playerId={playerId} />}</RequireSession>
  );
}

/** "/equipos/:teamId/plantilla/:playerId/tarjeta/puntuar" */
export function RateRoute() {
  const { teamId = '', playerId = '' } = useParams();
  return <RequireSession>{() => <RatePage teamId={teamId} playerId={playerId} />}</RequireSession>;
}

/** "/equipos/:teamId/plantilla/:playerId" — el perfil del jugador para el cuerpo técnico. */
export function PlayerProfileRoute() {
  const { teamId = '', playerId = '' } = useParams();
  return (
    <RequireSession>
      {() => <PlayerProfilePage teamId={teamId} playerId={playerId} />}
    </RequireSession>
  );
}

/** "/conocimiento" — el examen de conocimiento por posición. */
export function KnowledgeRoute() {
  return <RequireSession>{(me) => <KnowledgePage me={me} />}</RequireSession>;
}

/** "/conocimiento/examen/:examId" — un examen en curso o su resultado. */
export function ExamRoute() {
  const { examId = '' } = useParams();
  return <RequireSession>{() => <ExamPage examId={examId} />}</RequireSession>;
}

/** "/equipos/:teamId/planificador" — armar la alineación (cuerpo técnico). */
export function PlannerRoute() {
  const { teamId = '' } = useParams();
  return <RequireSession>{() => <PlannerPage teamId={teamId} />}</RequireSession>;
}

/** "/equipos/:teamId/alineaciones" */
export function SavedLineupsRoute() {
  const { teamId = '' } = useParams();
  return <RequireSession>{() => <SavedLineupsPage teamId={teamId} />}</RequireSession>;
}

/** "/equipos/:teamId/alineaciones/:lineupId" */
export function LineupViewRoute() {
  const { teamId = '', lineupId = '' } = useParams();
  return (
    <RequireSession>{() => <LineupViewPage teamId={teamId} lineupId={lineupId} />}</RequireSession>
  );
}
