import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';

import {
  AssessRoute,
  ExamRoute,
  KnowledgeRoute,
  MyCardRoute,
  MyGameRoute,
  MatchesRoute,
  MatchFormRoute,
  MatchRoute,
  MyDataRoute,
  AccountRoute,
  TeamRoute,
  LineupViewRoute,
  PlannerRoute,
  SavedLineupsRoute,
  ValidationRoute,
  PlayerProfileRoute,
  RateRoute,
  StaffCardRoute,
  HistoryRoute,
  HomeRoute,
  InviteRoute,
  TeamRolesRoute,
  ClubCodesRoute,
  CreateClubRoute,
  JoinRoute,
  LoginRoute,
  ProfileRoute,
  QuizRoute,
  ResultRoute,
  ScienceRoute,
  SquadRoute,
} from '../features/auth/SessionRoutes';

/** Maqueta del sistema de diseño v2: solo en desarrollo, fuera del build de producción. */
const ShowcasePage = import.meta.env.DEV
  ? lazy(() =>
      import('../features/showcase/ShowcasePage').then((m) => ({ default: m.ShowcasePage })),
    )
  : null;

export const router = createBrowserRouter([
  ...(ShowcasePage
    ? [
        {
          path: '/muestra/*',
          element: (
            <Suspense>
              <ShowcasePage />
            </Suspense>
          ),
        },
      ]
    : []),
  { path: '/', element: <HomeRoute /> },
  { path: '/entrar', element: <LoginRoute /> },
  { path: '/tus-datos', element: <MyDataRoute /> },
  { path: '/unirse/:code', element: <JoinRoute /> },
  { path: '/crear-club/:code?', element: <CreateClubRoute /> },
  { path: '/equipos/:teamId/invitar', element: <InviteRoute /> },
  { path: '/equipos/:teamId/roles', element: <TeamRolesRoute /> },
  { path: '/plataforma/codigos', element: <ClubCodesRoute /> },
  { path: '/equipos/:teamId/plantilla', element: <SquadRoute /> },
  { path: '/equipos/:teamId/planificador', element: <PlannerRoute /> },
  { path: '/equipos/:teamId/partidos', element: <MatchesRoute /> },
  { path: '/equipos/:teamId/partidos/nuevo', element: <MatchFormRoute /> },
  { path: '/equipos/:teamId/partidos/:matchId', element: <MatchRoute /> },
  { path: '/equipos/:teamId/partidos/:matchId/editar', element: <MatchFormRoute /> },
  { path: '/equipos/:teamId/alineaciones', element: <SavedLineupsRoute /> },
  { path: '/equipos/:teamId/validacion', element: <ValidationRoute /> },
  { path: '/equipos/:teamId/alineaciones/:lineupId', element: <LineupViewRoute /> },
  { path: '/equipos/:teamId/plantilla/:playerId', element: <PlayerProfileRoute /> },
  { path: '/equipos/:teamId/plantilla/:playerId/valorar', element: <AssessRoute /> },
  { path: '/equipos/:teamId/plantilla/:playerId/tarjeta', element: <StaffCardRoute /> },
  { path: '/equipos/:teamId/plantilla/:playerId/tarjeta/puntuar', element: <RateRoute /> },
  { path: '/equipos/:teamId/tarjeta', element: <MyCardRoute /> },
  { path: '/equipos/:teamId/mi-juego', element: <MyGameRoute /> },
  { path: '/equipos/:teamId/equipo', element: <TeamRoute /> },
  { path: '/conocimiento', element: <KnowledgeRoute /> },
  { path: '/conocimiento/examen/:examId', element: <ExamRoute /> },
  { path: '/equipos/:teamId/test', element: <QuizRoute /> },
  { path: '/resultados/:attemptId', element: <ResultRoute /> },
  { path: '/historial', element: <HistoryRoute /> },
  { path: '/bases', element: <ScienceRoute /> },
  { path: '/perfil', element: <ProfileRoute /> },
  { path: '/cuenta', element: <AccountRoute /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);
