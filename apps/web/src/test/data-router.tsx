import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';

/**
 * Una pantalla dentro de un router de datos, como en la app: hace falta para lo que usa
 * `useBlocker` (el aviso de cambios sin guardar), que `MemoryRouter` no admite.
 */
export function InDataRouter({ children, path = '/' }: { children: ReactNode; path?: string }) {
  const router = createMemoryRouter([{ path: '*', element: children }], {
    initialEntries: [path],
  });
  return <RouterProvider router={router} />;
}
