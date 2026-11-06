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

  it('si venía de un enlace del grupo, Google lo devuelve a esa pantalla (2026-11-06)', async () => {
    const fetch = vi.fn().mockResolvedValue(
      new Response(JSON.stringify({ url: 'https://accounts.google.com/x', redirect: true }), {
        status: 200,
        headers: { 'content-type': 'application/json' },
      }),
    );
    vi.stubGlobal('fetch', fetch);
    renderAt(`/entrar?volver=${encodeURIComponent('/equipos/x/partidos/y')}`);

    await userEvent.click(screen.getByRole('button', { name: 'Continuar con Google' }));
    await vi.waitFor(() => expect(fetch).toHaveBeenCalled());
    const body = JSON.parse(fetch.mock.calls[0]![1].body as string);
    expect(body.callbackURL).toBe(`${window.location.origin}/equipos/x/partidos/y`);
    expect(body.errorCallbackURL).toBe(
      `${window.location.origin}/entrar?volver=%2Fequipos%2Fx%2Fpartidos%2Fy&error=google`,
    );
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
