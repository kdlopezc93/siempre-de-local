import { createBrowserRouter, Navigate } from 'react-router';

import {
  AssessRoute,
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

export const router = createBrowserRouter([
  { path: '/', element: <HomeRoute /> },
  { path: '/entrar', element: <LoginRoute /> },
  { path: '/unirse/:code', element: <JoinRoute /> },
  { path: '/equipos/:teamId/invitar', element: <InviteRoute /> },
  { path: '/equipos/:teamId/plantilla', element: <SquadRoute /> },
  { path: '/equipos/:teamId/plantilla/:playerId/valorar', element: <AssessRoute /> },
  { path: '/equipos/:teamId/test', element: <QuizRoute /> },
  { path: '/resultados/:attemptId', element: <ResultRoute /> },
  { path: '/historial', element: <HistoryRoute /> },
  { path: '/bases', element: <ScienceRoute /> },
  { path: '/perfil', element: <ProfileRoute /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);
