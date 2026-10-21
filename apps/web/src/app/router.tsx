import { createBrowserRouter, Navigate } from 'react-router';

import {
  HistoryRoute,
  HomeRoute,
  InviteRoute,
  JoinRoute,
  LoginRoute,
  ProfileRoute,
  QuizRoute,
  ResultRoute,
  ScienceRoute,
  SpikePwaRoute,
} from '../features/auth/SessionRoutes';

export const router = createBrowserRouter([
  { path: '/', element: <HomeRoute /> },
  { path: '/entrar', element: <LoginRoute /> },
  { path: '/unirse/:code', element: <JoinRoute /> },
  { path: '/equipos/:teamId/invitar', element: <InviteRoute /> },
  { path: '/equipos/:teamId/test', element: <QuizRoute /> },
  { path: '/resultados/:attemptId', element: <ResultRoute /> },
  { path: '/historial', element: <HistoryRoute /> },
  { path: '/bases', element: <ScienceRoute /> },
  { path: '/perfil', element: <ProfileRoute /> },
  { path: '/prueba-pwa', element: <SpikePwaRoute /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);
