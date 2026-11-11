import { POLICY_VERSION } from '@sdl/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fakeApi } from '../../test/fake-api';
import { DEFAULT_PROFILE } from '../../test/me-fixture';
import { CreateClubRoute } from '../auth/SessionRoutes';

const CODE = 'K7Q2M9XDAB';
const TEAM = '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f71';
const CLUB_ID = '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f72';
const USER = {
  id: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f70',
  name: 'Pedro',
  email: 'p@example.com',
  platformAdmin: false,
};
const CONSENT = { policyVersion: POLICY_VERSION, acceptedAt: '2026-10-21T10:00:00.000Z' };
const me = (consent: typeof CONSENT | null) => ({
  status: 200,
  body: { user: USER, consent, teams: [], profile: DEFAULT_PROFILE, clubs: [] },
});
const PREVIEW = { status: 200, body: { expiresAt: '2026-11-12T12:00:00.000Z', kind: 'school' } };
const CREATED = {
  status: 201,
  body: { clubId: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f72', teamId: TEAM },
};

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/crear-club/:code?', element: <CreateClubRoute /> },
      { path: '/', element: <p>Inicio</p> },
      { path: '/clubes/:clubId', element: <p>La escuela</p> },
    ],
    { initialEntries: [path] },
  );
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
  return router;
}

const SUB = `Sub-${new Date().getFullYear() - 2014}`;

describe('crear mi escuela (2026-11-07)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sin sesión, el código de escuela pide entrar para armar la escuela', async () => {
    fakeApi({
      'GET /api/v1/me': { status: 401, body: { error: { code: 'UNAUTHENTICATED', message: 'x' } } },
      [`GET /api/v1/club-codes/${CODE}`]: PREVIEW,
    });
    renderAt(`/crear-club/${CODE}`);
    expect(await screen.findByRole('heading', { name: 'Arma tu escuela' })).toBeInTheDocument();
  });

  it('la escuela y su primer grupo: categoría por años, género y nombre sugeridos', async () => {
    let body: unknown;
    fakeApi({
      'GET /api/v1/me': me(CONSENT),
      [`GET /api/v1/club-codes/${CODE}`]: PREVIEW,
      'POST /api/v1/clubs': (init) => {
        body = JSON.parse(init.body as string);
        return CREATED;
      },
    });
    const router = renderAt(`/crear-club/${CODE}`);
    await userEvent.type(await screen.findByLabelText('Nombre de la escuela'), 'Escuela Semillas');
    await userEvent.type(screen.getByLabelText('Ciudad o barrio'), 'Kennedy');
    await userEvent.selectOptions(screen.getByLabelText('Desde'), '2014');
    await userEvent.selectOptions(screen.getByLabelText('Hasta'), '2015');
    expect(screen.getByLabelText('Nombre de la categoría')).toHaveValue(SUB);
    expect(screen.getByLabelText(/Nombre del grupo/)).toHaveValue('Masculino');
    await userEvent.click(screen.getByRole('button', { name: 'Femenino' }));
    expect(screen.getByLabelText(/Nombre del grupo/)).toHaveValue('Femenino');
    await userEvent.click(screen.getByRole('button', { name: 'Crear mi escuela' }));

    expect(body).toMatchObject({
      code: CODE,
      clubName: 'Escuela Semillas',
      city: 'Kennedy',
      teamName: `${SUB} femenino`,
      category: SUB,
      birthYears: { from: 2014, to: 2015 },
      gender: 'female',
      alsoPlays: false,
    });
    expect(
      await screen.findByRole('heading', { name: '¡Listo, ya tienes tu escuela!' }),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('link', { name: 'Ir a mi escuela' }));
    expect(router.state.location.pathname).toBe(`/clubes/${CLUB_ID}`);
  });

  it('mayores: «o antes» deja la categoría abierta por abajo', async () => {
    let body: unknown;
    fakeApi({
      'GET /api/v1/me': me(CONSENT),
      [`GET /api/v1/club-codes/${CODE}`]: PREVIEW,
      'POST /api/v1/clubs': (init) => {
        body = JSON.parse(init.body as string);
        return CREATED;
      },
    });
    renderAt(`/crear-club/${CODE}`);
    await userEvent.type(await screen.findByLabelText('Nombre de la escuela'), 'Escuela Semillas');
    await userEvent.type(screen.getByLabelText('Ciudad o barrio'), 'Kennedy');
    await userEvent.selectOptions(screen.getByLabelText('Hasta'), '2008');
    await userEvent.selectOptions(screen.getByLabelText('Desde'), 'o antes');
    expect(screen.getByLabelText('Nombre de la categoría')).toHaveValue('Mayores');
    expect(screen.getByText(/años o más\./)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Crear mi escuela' }));
    expect(body).toMatchObject({
      teamName: 'Mayores masculino',
      category: 'Mayores',
      birthYears: { from: null, to: 2008 },
    });
  });
});
