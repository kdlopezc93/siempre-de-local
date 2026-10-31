import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fakeApi } from '../../test/fake-api';
import { TEAM_A } from '../../test/me-two-teams';
import { ChargePage } from './ChargePage';
import { ChargesPage } from './ChargesPage';
import { MyChargesPage } from './MyChargesPage';
import { NewChargePage } from './NewChargePage';

const C1 = '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6fc1';
const M1 = '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6fa1';
const P1 = '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6fd1';
const [ANA, BETO, CIRO] = [
  '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6fb1',
  '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6fb2',
  '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6fb3',
];
const past = new Date(Date.now() - 86_400_000).toISOString();

const summary = (over: object = {}) => ({
  id: C1,
  kind: 'vaca',
  title: null,
  match: { id: M1, opponent: 'Los Pibes', startsAt: past },
  tournament: null,
  split: 'total',
  amount: 70_000,
  dueOn: null,
  createdAt: past,
  cancelled: false,
  balance: { billed: 70_200, collected: 10_000, pending: 60_200 },
  people: 3,
  paidPeople: 0,
  reported: 1,
  ...over,
});
const share = (userId: string, displayName: string, jerseyNumber: number | null, over = {}) => ({
  userId,
  displayName,
  jerseyNumber,
  amount: 23_400,
  note: null,
  paid: 0,
  reported: 0,
  status: 'pending',
  ...over,
});
const DETAIL = {
  charge: summary(),
  shares: [
    share(ANA, 'Ana', 4, { paid: 10_000, status: 'partial' }),
    share(BETO, 'Beto', 9, { reported: 23_400 }),
    share(CIRO, 'Ciro', null),
  ],
  payments: [
    {
      id: P1,
      userId: BETO,
      amount: 23_400,
      method: 'nequi',
      paidOn: '2026-10-30',
      status: 'reported',
      reportedBy: { id: BETO, name: 'Beto' },
      reviewedBy: null,
      createdAt: past,
    },
  ],
};

function renderAt(path: string, routes: { path: string; element: ReactNode }[]) {
  const router = createMemoryRouter(
    [...routes, { path: '/equipos/:teamId/cobros/:chargeId', element: <p>el cobro</p> }],
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
}

describe('cobros en la app (06 Cobros)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('la lista: lo que falta en grande, lo que espera confirmación arriba, y la fila de la vaca', async () => {
    fakeApi({
      [`GET /api/v1/teams/${TEAM_A}/charges`]: {
        status: 200,
        body: {
          items: [
            summary(),
            summary({
              id: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6fc2',
              kind: 'registration',
              match: null,
              tournament: { id: M1, name: 'Copa del barrio' },
              reported: 0,
              people: 14,
              paidPeople: 12,
              balance: { billed: 560_000, collected: 480_000, pending: 80_000 },
            }),
          ],
          balance: { billed: 630_200, collected: 490_000, pending: 140_200 },
        },
      },
    });
    renderAt('/c', [
      { path: '/c', element: <ChargesPage teamId={TEAM_A} teamName="QLeones FC" /> },
    ]);

    const lead = await screen.findByRole('region', { name: 'Saldo del equipo' });
    expect(lead).toHaveTextContent('$140.200');
    expect(lead).toHaveTextContent('Entró $490.000 de $630.200');
    const waiting = screen.getByRole('heading', { name: 'Por confirmar (1)' });
    expect(waiting).toBeVisible();
    expect(screen.getByRole('link', { name: /Vaca.*Contra Los Pibes/ })).toBeVisible();
    expect(screen.getByRole('list', { name: '12 pagaron y 2 deben' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Nuevo cobro' })).toHaveAttribute(
      'href',
      `/equipos/${TEAM_A}/cobros/nuevo`,
    );
  });

  it('un cobro: confirmar el "Ya pagué" y registrar el abono de alguien', async () => {
    let reviewed = '';
    let paid: unknown;
    fakeApi({
      [`GET /api/v1/teams/${TEAM_A}/charges/${C1}`]: { status: 200, body: DETAIL },
      [`POST /api/v1/teams/${TEAM_A}/charges/${C1}/payments/${P1}/confirm`]: () => {
        reviewed = 'confirm';
        return {
          status: 200,
          body: {
            ...DETAIL,
            charge: summary({ reported: 0 }),
            shares: [
              DETAIL.shares[0],
              share(BETO, 'Beto', 9, { paid: 23_400, status: 'paid' }),
              DETAIL.shares[2],
            ],
            payments: [{ ...DETAIL.payments[0], status: 'confirmed' }],
          },
        };
      },
      [`POST /api/v1/teams/${TEAM_A}/charges/${C1}/payments`]: (init) => {
        paid = JSON.parse(init.body as string);
        return { status: 201, body: DETAIL };
      },
    });
    const user = userEvent.setup();
    renderAt('/c', [{ path: '/c', element: <ChargePage teamId={TEAM_A} chargeId={C1} /> }]);

    const lead = await screen.findByRole('region', { name: 'Saldo del cobro' });
    expect(lead).toHaveTextContent('$60.200');
    expect(lead).toHaveTextContent('$70.000 repartidos entre 3, $23.400 cada uno. Sobran $200.');
    expect(within(lead).getByRole('list', { name: '1 abonó y 2 deben' })).toBeInTheDocument();

    expect(screen.getByText(/dice que pagó/)).toHaveTextContent(
      'Beto dice que pagó $23.400 por Nequi.',
    );
    await user.click(screen.getByRole('button', { name: 'Confirmar' }));
    await vi.waitFor(() => expect(reviewed).toBe('confirm'));
    expect(await screen.findByRole('button', { name: /Beto: Pagó/ })).toBeVisible();

    // Ana abonó 10.000: le falta 13.400.
    await user.click(screen.getByRole('button', { name: /Ana: Abonó/ }));
    const sheet = await screen.findByRole('dialog', { name: 'Ana' });
    expect(within(sheet).getByLabelText(/Cuánto pagó \(falta \$13\.400\)/)).toHaveValue('$13.400');
    await user.click(within(sheet).getByRole('button', { name: 'Nequi' }));
    await user.click(within(sheet).getByRole('button', { name: 'Registrar el pago' }));
    await vi.waitFor(() =>
      expect(paid).toMatchObject({ userId: ANA, amount: 13_400, method: 'nequi' }),
    );
  });

  it('nuevo cobro desde el partido: arranca con los que vinieron y muestra el reparto', async () => {
    let created: unknown;
    fakeApi({
      [`GET /api/v1/teams/${TEAM_A}/members`]: {
        status: 200,
        body: {
          staff: [],
          players: [
            { userId: ANA, displayName: 'Ana', jerseyNumber: 4, injured: false, bestBand: null },
            { userId: BETO, displayName: 'Beto', jerseyNumber: 9, injured: false, bestBand: null },
            {
              userId: CIRO,
              displayName: 'Ciro',
              jerseyNumber: null,
              injured: false,
              bestBand: null,
            },
          ],
        },
      },
      [`GET /api/v1/teams/${TEAM_A}/matches`]: { status: 200, body: { items: [] } },
      [`GET /api/v1/teams/${TEAM_A}/tournaments`]: { status: 200, body: { items: [] } },
      [`GET /api/v1/teams/${TEAM_A}/matches/${M1}`]: {
        status: 200,
        body: {
          match: {
            id: M1,
            kind: 'friendly',
            tournament: null,
            format: 'F11',
            startsAt: past,
            place: 'La 14',
            opponent: 'Los Pibes',
            status: 'scheduled',
            open: false,
            editable: true,
            createdBy: null,
            replies: { yes: 3, no: 0, pending: 0, injured: 0 },
            myReply: null,
            published: null,
            result: null,
            myRating: null,
            attendanceTaken: true,
          },
          roster: [
            {
              playerId: ANA,
              displayName: 'Ana',
              jerseyNumber: 4,
              reply: 'yes',
              canRate: true,
              injured: false,
              came: true,
            },
            {
              playerId: BETO,
              displayName: 'Beto',
              jerseyNumber: 9,
              reply: 'yes',
              canRate: true,
              injured: false,
              came: true,
            },
            {
              playerId: CIRO,
              displayName: 'Ciro',
              jerseyNumber: null,
              reply: 'yes',
              canRate: true,
              injured: false,
              came: false,
            },
          ],
        },
      },
      [`POST /api/v1/teams/${TEAM_A}/charges`]: (init) => {
        created = JSON.parse(init.body as string);
        return { status: 201, body: DETAIL };
      },
    });
    const user = userEvent.setup();
    renderAt('/n', [{ path: '/n', element: <NewChargePage teamId={TEAM_A} fromMatch={M1} /> }]);

    expect(await screen.findByRole('heading', { name: /¿Qué se cobra\?/ })).toBeVisible();
    expect(screen.getByRole('button', { name: 'Vaca' })).toHaveAttribute('aria-pressed', 'true');
    await user.click(screen.getByRole('button', { name: 'Seguir' }));

    expect(await screen.findByRole('checkbox', { name: /Ana/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Beto/ })).toBeChecked();
    expect(screen.getByRole('checkbox', { name: /Ciro.*Dijo voy y no vino/ })).not.toBeChecked();
    await user.type(screen.getByLabelText('El total'), '70000');
    expect(screen.getByLabelText('El total')).toHaveValue('$70.000');
    expect(screen.getByText(/Entre 2 personas/)).toHaveTextContent(
      'Entre 2 personas: $35.000 cada uno.',
    );
    // También a los que dijeron voy y no vinieron: 3, a $23.400, sobran $200.
    await user.click(screen.getByRole('checkbox', { name: /dijeron voy y no vinieron/ }));
    expect(screen.getByText(/Entre 3 personas/)).toHaveTextContent(
      'Entre 3 personas: $23.400 cada uno. Sobran $200.',
    );
    await user.click(screen.getByRole('button', { name: 'Crear cobro' }));
    await vi.waitFor(() =>
      expect(created).toMatchObject({
        kind: 'vaca',
        matchId: M1,
        tournamentId: null,
        split: 'total',
        amount: 70_000,
        playerIds: [ANA, BETO, CIRO],
      }),
    );
    expect(await screen.findByText('el cobro')).toBeInTheDocument();
  });

  it('el jugador: lo que debe y "Ya pagué" (con abono)', async () => {
    let reported: unknown;
    const item = {
      charge: {
        id: C1,
        kind: 'vaca',
        title: null,
        match: { id: M1, opponent: 'Los Pibes', startsAt: past },
        tournament: null,
        dueOn: null,
        createdAt: past,
      },
      amount: 23_400,
      paid: 0,
      reported: 0,
      status: 'pending',
      payments: [],
    };
    fakeApi({
      [`GET /api/v1/teams/${TEAM_A}/me/charges`]: {
        status: 200,
        body: { items: [item], owed: 23_400 },
      },
      [`POST /api/v1/teams/${TEAM_A}/me/charges/${C1}/payments`]: (init) => {
        reported = JSON.parse(init.body as string);
        return {
          status: 201,
          body: { items: [{ ...item, reported: 10_000 }], owed: 23_400 },
        };
      },
    });
    const user = userEvent.setup();
    renderAt('/m', [{ path: '/m', element: <MyChargesPage teamId={TEAM_A} /> }]);

    const lead = await screen.findByRole('region', { name: 'Lo que debes' });
    expect(lead).toHaveTextContent('Debes$23.400');
    await user.click(screen.getByRole('button', { name: 'Ya pagué' }));
    const sheet = await screen.findByRole('dialog', { name: 'Ya pagué: vaca' });
    const field = within(sheet).getByLabelText('Cuánto pagaste');
    await user.clear(field);
    await user.type(field, '10000');
    await user.click(within(sheet).getByRole('button', { name: 'Avisar que pagué' }));
    await vi.waitFor(() => expect(reported).toMatchObject({ amount: 10_000, method: 'nequi' }));
    expect(await screen.findByText(/falta que el tesorero lo confirme/)).toBeVisible();
  });
});
