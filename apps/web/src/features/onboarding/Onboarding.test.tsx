import { POLICY_VERSION } from '@sdl/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fakeApi } from '../../test/fake-api';
import { HomeRoute } from '../auth/SessionRoutes';
import { DEFAULT_PROFILE } from '../../test/me-fixture';

const USER = {
  id: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f70',
  name: 'Kevin López',
  email: 'k@example.com',
};
const CONSENT = { policyVersion: POLICY_VERSION, acceptedAt: '2026-10-21T10:00:00.000Z' };
const TEAM = {
  team: {
    id: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f71',
    name: 'Primer equipo',
    format: 'F11',
    formats: ['F11'],
    season: '2026',
    photoUrl: null,
  },
  club: { id: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f72', name: 'Los del Barrio' },
  roles: ['player'],
};

function renderHome() {
  const router = createMemoryRouter(
    [
      { path: '/', element: <HomeRoute /> },
      { path: '/unirse/:code', element: <p>Unirse</p> },
    ],
    { initialEntries: ['/'] },
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

describe('puertas de entrada al inicio', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sin equipo: pide la invitación y acepta el código escrito como venga', async () => {
    fakeApi({
      'GET /api/v1/me': {
        status: 200,
        body: { user: USER, consent: CONSENT, teams: [], profile: DEFAULT_PROFILE, clubs: [] },
      },
    });
    const router = renderHome();

    expect(
      await screen.findByRole('heading', { name: 'Todavía no tienes equipo' }),
    ).toBeInTheDocument();
    const input = screen.getByRole('textbox', { name: 'Código de invitación' });

    await userEvent.type(input, 'abc');
    await userEvent.click(screen.getByRole('button', { name: 'Usar código' }));
    expect(screen.getByText(/El código tiene 10 letras y números/)).toBeInTheDocument();

    await userEvent.clear(input);
    await userEvent.type(input, 'k7q2m-9xdab');
    await userEvent.click(screen.getByRole('button', { name: 'Usar código' }));
    expect(router.state.location.pathname).toBe('/unirse/K7Q2M9XDAB');
  });

  it('con equipo pero sin la política vigente: la pide antes de entrar', async () => {
    let consent: typeof CONSENT | null = null;
    fakeApi({
      'GET /api/v1/me': () => ({
        status: 200,
        body: { user: USER, consent, teams: [TEAM], profile: DEFAULT_PROFILE, clubs: [] },
      }),
      'POST /api/v1/me/consent': () => {
        consent = CONSENT;
        return { status: 201, body: { consent: CONSENT } };
      },
    });
    renderHome();

    expect(await screen.findByRole('heading', { name: 'Antes de seguir' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Tengo 18 años o más' }));
    await userEvent.click(screen.getByRole('button', { name: 'Acepto' }));
    expect(await screen.findByRole('heading', { name: 'Hola, Kevin' })).toBeInTheDocument();
  });
});
