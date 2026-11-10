import { POLICY_VERSION } from '@sdl/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fakeApi } from '../../test/fake-api';
import { DEFAULT_PROFILE } from '../../test/me-fixture';
import { HomeRoute, KidChargesRoute, KidHomeRoute, KidMatchesRoute } from '../auth/SessionRoutes';

const MINOR = '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f90';
const TEAM = '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f71';
const MATCH = '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f91';
const BASE = `/api/v1/me/children/${MINOR}/teams/${TEAM}`;

const ME = {
  user: {
    id: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f70',
    name: 'Diana',
    email: 'd@example.com',
    platformAdmin: false,
  },
  consent: { policyVersion: POLICY_VERSION, acceptedAt: '2026-11-01T10:00:00.000Z' },
  profile: { ...DEFAULT_PROFILE, displayName: 'Diana Ramírez' },
  teams: [],
  clubs: [],
  children: [
    {
      id: MINOR,
      name: 'Sofía Ramírez',
      birthYear: 2017,
      relationship: 'mother',
      teams: [
        {
          team: { id: TEAM, name: 'Sub-10 femenino' },
          club: { id: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f72', name: 'Semillas', kind: 'school' },
        },
      ],
    },
  ],
};

const training = (myReply: 'yes' | 'no' | null) => ({
  id: MATCH,
  format: 'F8',
  startsAt: new Date(Date.now() + 3 * 86_400_000).toISOString(),
  kind: 'training',
  place: 'Sede Kennedy',
  opponent: null,
  tournament: null,
  status: 'scheduled',
  open: true,
  editable: true,
  createdBy: null,
  replies: { yes: 0, no: 0, pending: 1, injured: 0 },
  myReply,
  published: null,
  result: null,
  attendanceTaken: false,
  myRating: null,
});

const CHARGES = {
  items: [
    {
      charge: {
        id: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f92',
        kind: 'fee',
        title: 'Mensualidad de noviembre',
        match: null,
        tournament: null,
        dueOn: null,
        createdAt: '2026-11-01T10:00:00.000Z',
      },
      forPlayer: null,
      amount: 120_000,
      paid: 0,
      reported: 0,
      status: 'pending',
      payments: [],
    },
  ],
  owed: 120_000,
};

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/', element: <HomeRoute /> },
      { path: '/deportistas/:minorId/equipos/:teamId', element: <KidHomeRoute /> },
      { path: '/deportistas/:minorId/equipos/:teamId/partidos', element: <KidMatchesRoute /> },
      { path: '/deportistas/:minorId/equipos/:teamId/cuentas', element: <KidChargesRoute /> },
    ],
    { initialEntries: [path] },
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

describe('la app del acudiente (2026-11-10)', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('sin equipos propios, "/" abre lo de su hija y responde por ella desde el inicio', async () => {
    let reply: unknown;
    fakeApi({
      'GET /api/v1/me': { status: 200, body: ME },
      [`GET ${BASE}/matches`]: { status: 200, body: { items: [training(null)] } },
      [`GET ${BASE}/charges`]: { status: 200, body: CHARGES },
      [`PUT ${BASE}/matches/${MATCH}/reply`]: (init) => {
        reply = JSON.parse(init.body as string);
        return { status: 200, body: { match: training('yes'), roster: null } };
      },
    });
    const router = renderAt('/');

    expect(
      await screen.findByRole('heading', { name: 'Hola, Diana Lo de Sofía' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/deportistas/${MINOR}/equipos/${TEAM}`);

    const call = await screen.findByRole('group', { name: '¿Sofía va?' });
    await userEvent.click(within(call).getByRole('button', { name: 'Va' }));
    expect(reply).toEqual({ reply: 'yes' });
    expect(await within(call).findByRole('button', { name: 'Va' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(await screen.findByRole('link', { name: /Por pagar: \$120\.000/ })).toHaveAttribute(
      'href',
      `/deportistas/${MINOR}/equipos/${TEAM}/cuentas`,
    );
  });

  it('Cuentas: lo que debe la niña y "Ya pagué" a su nombre', async () => {
    let paid: unknown;
    fakeApi({
      'GET /api/v1/me': { status: 200, body: ME },
      [`GET ${BASE}/charges`]: { status: 200, body: CHARGES },
      [`POST ${BASE}/charges/${CHARGES.items[0]!.charge.id}/payments`]: (init) => {
        paid = JSON.parse(init.body as string);
        return {
          status: 201,
          body: { ...CHARGES, items: [{ ...CHARGES.items[0]!, reported: 120_000 }] },
        };
      },
    });
    renderAt(`/deportistas/${MINOR}/equipos/${TEAM}/cuentas`);

    expect(await screen.findByText('Por pagar')).toBeInTheDocument();
    expect(screen.getByText('En 1 cobro a nombre de Sofía.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ya pagué' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Avisar que pagué' }));
    expect(paid).toMatchObject({ amount: 120_000, method: 'nequi' });
    expect(paid).not.toHaveProperty('forUserId');
  });

  it('un niño que no es suyo lleva al inicio', async () => {
    fakeApi({
      'GET /api/v1/me': { status: 200, body: ME },
      [`GET ${BASE}/matches`]: { status: 200, body: { items: [] } },
      [`GET ${BASE}/charges`]: { status: 200, body: { items: [], owed: 0 } },
    });
    const router = renderAt(`/deportistas/otro/equipos/${TEAM}/partidos`);
    // "/" lo vuelve a llevar a lo de su hija.
    expect(
      await screen.findByRole('heading', { name: 'Hola, Diana Lo de Sofía' }),
    ).toBeInTheDocument();
    expect(router.state.location.pathname).toBe(`/deportistas/${MINOR}/equipos/${TEAM}`);
  });
});
