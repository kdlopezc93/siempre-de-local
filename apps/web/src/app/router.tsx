import { createBrowserRouter, Navigate } from 'react-router';

import { HomeRoute, LoginRoute } from '../features/auth/SessionRoutes';

export const router = createBrowserRouter([
  { path: '/', element: <HomeRoute /> },
  { path: '/entrar', element: <LoginRoute /> },
  { path: '*', element: <Navigate to="/" replace /> },
]);
