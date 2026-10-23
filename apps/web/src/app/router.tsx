import { lazy, Suspense } from 'react';
import { createBrowserRouter, Navigate } from 'react-router';

import {
  AssessRoute,
  ExamRoute,
  KnowledgeRoute,
  MyCardRoute,
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
  { path: '/unirse/:code', element: <JoinRoute /> },
  { path: '/equipos/:teamId/invitar', element: <InviteRoute /> },
  { path: '/equipos/:teamId/plantilla', element: <SquadRoute /> },
  { path: '/equipos/:teamId/planificador', element: <PlannerRoute /> },
  { path: '/equipos/:teamId/alineaciones', element: <SavedLineupsRoute /> },
  { path: '/equipos/:teamId/validacion', element: <ValidationRoute /> },
  { path: '/equipos/:teamId/alineaciones/:lineupId', element: <LineupViewRoute /> },
  { path: '/equipos/:teamId/plantilla/:playerId', element: <PlayerProfileRoute /> },
  { path: '/equipos/:teamId/plantilla/:playerId/valorar', element: <AssessRoute /> },
  { path: '/equipos/:teamId/plantilla/:playerId/tarjeta', element: <StaffCardRoute /> },
  { path: '/equipos/:teamId/plantilla/:playerId/tarjeta/puntuar', element: <RateRoute /> },
  { path: '/equipos/:teamId/tarjeta', element: <MyCardRoute /> },
  { path: '/conocimiento', element: <KnowledgeRoute /> },
  { path: '/conocimiento/examen/:examId', element: <ExamRoute /> },
  { path: '/equipos/:teamId/test', element: <QuizRoute /> },
  { path: '/resultados/:attemptId', element: <ResultRoute /> },
  { path: '/historial', element: <HistoryRoute /> },
  { path: '/bases', element: <ScienceRoute /> },
  { path: '/perfil', element: <ProfileRoute /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);
