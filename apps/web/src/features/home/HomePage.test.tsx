import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { HomePage } from './HomePage';

const USER = {
  id: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f70',
  name: 'Kevin López',
  email: 'k@example.com',
};

const ME = {
  user: USER,
  consent: { policyVersion: 'x', acceptedAt: '2026-10-21T10:00:00.000Z' },
  teams: [
    {
      team: {
        id: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f71',
        name: 'Primer equipo',
        format: 'F11' as const,
        season: '2026',
      },
      club: { id: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f72', name: 'Los del Barrio' },
      roles: ['coach' as const],
    },
  ],
  clubs: [],
};

function renderHome() {
  const client = new QueryClient({ defaultOptions: { mutations: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <HomePage me={ME} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('HomePage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('saluda por el primer nombre', () => {
    renderHome();
    expect(screen.getByRole('heading', { level: 1, name: 'Hola, Kevin' })).toBeInTheDocument();
  });

  it('lista sus equipos y, si es entrenador, el acceso para invitar', () => {
    renderHome();
    const teams = screen.getByRole('list', { name: 'Tus equipos' });
    expect(teams).toHaveTextContent('Primer equipo');
    expect(screen.getByRole('link', { name: 'Invitar jugadores' })).toHaveAttribute(
      'href',
      '/equipos/0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f71/invitar',
    );
  });

  it('pide confirmación antes de cerrar en todos los dispositivos', async () => {
    const fetchMock = vi.fn().mockResolvedValue(new Response('{}', { status: 200 }));
    vi.stubGlobal('fetch', fetchMock);
    renderHome();

    await userEvent.click(
      screen.getByRole('button', { name: 'Cerrar sesión en todos tus dispositivos' }),
    );
    expect(fetchMock).not.toHaveBeenCalled();
    expect(screen.getByText(/Vas a salir en este celular/)).toHaveFocus();

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('button', { name: 'Cerrar sesión' })).toBeInTheDocument();

    await userEvent.click(
      screen.getByRole('button', { name: 'Cerrar sesión en todos tus dispositivos' }),
    );
    await userEvent.click(screen.getByRole('button', { name: 'Sí, cerrar en todos' }));
    const paths = fetchMock.mock.calls.map(([url]) => (url as URL).pathname);
    expect(paths).toEqual(['/api/auth/revoke-sessions', '/api/auth/sign-out']);
  });
});
