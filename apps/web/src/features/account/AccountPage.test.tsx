import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, MemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ME_TWO_TEAMS } from '../../test/me-two-teams';
import { AccountPage } from './AccountPage';

const pushMock = vi.hoisted(() => ({ state: 'off' as string, mutate: vi.fn() }));
vi.mock('../../shared/push/use-push', () => ({
  usePush: () => ({
    state: pushMock.state,
    toggle: { mutate: pushMock.mutate, isPending: false, isError: false },
  }),
}));

function renderAccount() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}
    >
      <MemoryRouter>
        <AccountPage me={ME_TWO_TEAMS} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('Tu cuenta', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('tus equipos con tu rol y lo que permite, y el club que administras', () => {
    renderAccount();
    expect(screen.getByRole('heading', { level: 1, name: 'Kevin' })).toBeInTheDocument();
    expect(screen.getByText('Entrenador y jugador, dorsal 10')).toBeInTheDocument();
    expect(
      screen.getByText(/^Valora, puntúa la tarjeta, arma alineaciones, invita jugadores/),
    ).toBeInTheDocument();
    expect(screen.getByText('Dueño del club')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: /Editar mi perfil/ })).toHaveAttribute(
      'href',
      '/perfil',
    );
  });

  it('cerrar sesión se elige en una hoja: en este celular o en todos', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    renderAccount();
    await userEvent.click(screen.getByRole('button', { name: 'Cerrar sesión' }));
    expect(fetchMock).not.toHaveBeenCalled();
    await userEvent.click(await screen.findByRole('button', { name: 'En todos tus dispositivos' }));
    const paths = fetchMock.mock.calls.map(([url]) => (url as URL).pathname);
    expect(paths).toEqual(['/api/auth/revoke-sessions', '/api/auth/sign-out']);
  });

  it('descargar mis datos guarda el archivo que propone el API', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response('{}', {
        headers: {
          'content-type': 'application/json',
          'content-disposition': 'attachment; filename="mis-datos-siempre-de-local.json"',
        },
      }),
    );
    vi.stubGlobal('fetch', fetchMock);
    URL.createObjectURL = () => 'blob:x';
    URL.revokeObjectURL = () => {};
    const saved: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      saved.push(this.download);
    });
    renderAccount();
    await userEvent.click(screen.getByRole('button', { name: 'Descargar mis datos' }));
    await vi.waitFor(() => expect(saved).toEqual(['mis-datos-siempre-de-local.json']));
    vi.restoreAllMocks();
  });

  it('eliminar la cuenta: solo escribiendo ELIMINAR; si es el único dueño, lo explica', async () => {
    let body: unknown;
    const fetchMock = vi.fn((_input: URL, init: RequestInit) => {
      body = JSON.parse(init.body as string);
      return Promise.resolve(
        new Response(
          JSON.stringify({
            error: {
              code: 'LAST_CLUB_ADMIN',
              message:
                'Eres quien maneja Los del Barrio. Antes de eliminar tu cuenta, deja a otra persona como dueña o administradora del club.',
            },
          }),
          { status: 409, headers: { 'content-type': 'application/json' } },
        ),
      );
    });
    vi.stubGlobal('fetch', fetchMock);
    renderAccount();
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar mi cuenta' }));
    await screen.findByRole('textbox', { name: 'Escribe ELIMINAR para confirmar' });
    const submit = screen.getAllByRole('button', { name: 'Eliminar mi cuenta' }).at(-1)!;
    expect(submit).toBeDisabled();
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Escribe ELIMINAR para confirmar' }),
      'eliminar',
    );
    expect(submit).toBeEnabled();
    await userEvent.click(submit);
    expect(await screen.findByRole('alert')).toHaveTextContent('Eres quien maneja Los del Barrio');
    expect(body).toEqual({ confirmation: 'ELIMINAR' });
  });

  it('al eliminarla, va a la página de tus datos con la confirmación', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 204 })));
    const router = createMemoryRouter(
      [
        { path: '/cuenta', element: <AccountPage me={ME_TWO_TEAMS} /> },
        { path: '/tus-datos', element: <p>tus datos</p> },
      ],
      { initialEntries: ['/cuenta'] },
    );
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}
      >
        <RouterProvider router={router} />
      </QueryClientProvider>,
    );
    await userEvent.click(screen.getByRole('button', { name: 'Eliminar mi cuenta' }));
    await userEvent.type(
      await screen.findByRole('textbox', { name: /Escribe ELIMINAR/ }),
      'ELIMINAR',
    );
    await userEvent.click(screen.getAllByRole('button', { name: 'Eliminar mi cuenta' }).at(-1)!);
    await vi.waitFor(() => expect(router.state.location.search).toBe('?cuenta=eliminada'));
  });

  it('avisos: se activan con el interruptor; en iPhone sin instalar, explica cómo', async () => {
    pushMock.state = 'off';
    renderAccount();
    await userEvent.click(screen.getByRole('switch', { name: 'Avisarme en este celular' }));
    expect(pushMock.mutate).toHaveBeenCalledWith(true);
    cleanup();

    pushMock.state = 'ios-install';
    renderAccount();
    expect(screen.getByRole('switch', { name: 'Avisarme en este celular' })).toBeDisabled();
    expect(screen.getByText(/primero agrega la app al inicio/)).toBeInTheDocument();
  });
});
