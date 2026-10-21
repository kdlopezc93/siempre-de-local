import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { LoginPage } from './LoginPage';

function renderAt(url: string) {
  const router = createMemoryRouter([{ path: '/entrar', element: <LoginPage /> }], {
    initialEntries: [url],
  });
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('LoginPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('muestra el título y un único botón para continuar con Google', () => {
    renderAt('/entrar');
    expect(
      screen.getByRole('heading', { level: 1, name: 'Tu equipo, siempre de local' }),
    ).toBeInTheDocument();
    expect(screen.getAllByRole('button')).toHaveLength(1);
    expect(screen.getByRole('button', { name: 'Continuar con Google' })).toBeEnabled();
    expect(screen.queryByRole('alert')).not.toBeInTheDocument();
  });

  it('avisa si Google no completó el inicio de sesión', () => {
    renderAt('/entrar?error=google');
    expect(screen.getByRole('alert')).toHaveTextContent('Google no completó el inicio de sesión');
  });

  it('avisa si no hay conexión con el servidor al intentar entrar', async () => {
    vi.stubGlobal('fetch', vi.fn().mockRejectedValue(new TypeError('Failed to fetch')));
    renderAt('/entrar');

    await userEvent.click(screen.getByRole('button', { name: 'Continuar con Google' }));
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'No pudimos conectar con el servidor',
    );
    expect(screen.getByRole('button', { name: 'Continuar con Google' })).toBeEnabled();
  });
});
