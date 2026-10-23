import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ME_TWO_TEAMS } from '../../test/me-two-teams';
import { AccountPage } from './AccountPage';

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
    expect(screen.getByText('Entrenador y jugador')).toBeInTheDocument();
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
});
