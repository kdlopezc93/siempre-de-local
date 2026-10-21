import { createBrowserRouter, Navigate } from 'react-router';

import {
  HomeRoute,
  InviteRoute,
  JoinRoute,
  LoginRoute,
  SpikePwaRoute,
} from '../features/auth/SessionRoutes';

export const router = createBrowserRouter([
  { path: '/', element: <HomeRoute /> },
  { path: '/entrar', element: <LoginRoute /> },
  { path: '/unirse/:code', element: <JoinRoute /> },
  { path: '/equipos/:teamId/invitar', element: <InviteRoute /> },
  { path: '/prueba-pwa', element: <SpikePwaRoute /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);
