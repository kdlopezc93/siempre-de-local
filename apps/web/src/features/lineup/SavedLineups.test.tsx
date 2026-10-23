import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fakeApi } from '../../test/fake-api';
import { uuid } from '../../test/questionnaire-fixture';
import { PlannerPage } from './PlannerPage';
import { LineupViewPage, SavedLineupsPage } from './SavedLineupsPage';

const TEAM_ID = uuid(9);
const LINEUP_ID = uuid(90);
const TEAM = {
  team: {
    id: TEAM_ID,
    name: 'Los de la cuadra',
    format: 'F8',
    formats: ['F8'],
    season: '2026',
    club: { id: uuid(10), name: 'Los del Barrio' },
    ratingsVisibleToPlayers: true,
    matchRatingsVisibleToPlayers: true,
  },
  myRoles: ['coach'],
};
const player = (n: number, name: string, primary: string) => ({
  playerId: uuid(20 + n),
  displayName: name,
  jerseyNumber: n,
  preferredPositions: [],
  assessment: { primary, secondary: [] },
  rating: { [primary]: 80 },
});
const PLAYERS = [
  player(1, 'Julio', 'POR'),
  player(2, 'Andrés', 'LAT'),
  player(3, 'Samuel', 'LAT'),
  player(4, 'Cristian', 'DFC'),
  player(7, 'Gabriel', 'EXT'),
  player(11, 'Meza', 'EXT'),
  player(8, 'Julián', 'MC'),
  player(9, 'Daniel', 'DC'),
];
const SLOTS = ['POR', 'LAT-1', 'DFC', 'LAT-2', 'EXT-1', 'MC', 'EXT-2', 'DC'];
const SAVED = {
  id: LINEUP_ID,
  name: 'Fecha 3',
  matchDate: '2026-11-01',
  matchId: null,
  format: 'F8',
  formation: '1-3-3-1',
  mode: 'balanced',
  weights: { A: 0.15, V: 0.3, C: 0.2, R: 0.35 },
  priority: 'none',
  minKnowledgePct: null,
  fitVersion: 'fit-v1',
  available: PLAYERS.map((p) => p.playerId),
  pins: [],
  assignments: SLOTS.map((slotId, i) => ({
    slotId,
    playerId: PLAYERS[i]!.playerId,
    fit: 0.8,
    breakdown: { V: 1, R: 0.8 },
    pinned: false,
    manual: slotId === 'MC',
  })),
  bench: [],
  createdBy: { id: uuid(8), name: 'Profe' },
  createdAt: '2026-10-22T10:00:00.000Z',
  updatedAt: '2026-10-22T10:00:00.000Z',
};
const base = {
  [`GET /api/v1/teams/${TEAM_ID}`]: { status: 200, body: TEAM },
  [`GET /api/v1/teams/${TEAM_ID}/lineup-inputs`]: {
    status: 200,
    body: { format: 'F8', players: PLAYERS },
  },
};

function renderAt(
  path: string,
  element: ReactNode,
  extra: { path: string; element: ReactNode }[] = [],
) {
  const router = createMemoryRouter([{ path: path.split('?')[0]!, element }, ...extra], {
    initialEntries: [path],
  });
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

describe('alineaciones guardadas', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('guardar desde el planificador; guardar otra vez actualiza la misma', async () => {
    const sent: { method: string; body: { name: string; matchDate: string; formation: string } }[] =
      [];
    fakeApi({
      ...base,
      [`POST /api/v1/teams/${TEAM_ID}/lineups`]: (init) => {
        sent.push({ method: 'POST', body: JSON.parse(init.body as string) });
        return { status: 201, body: { lineup: SAVED } };
      },
      [`PUT /api/v1/teams/${TEAM_ID}/lineups/${LINEUP_ID}`]: (init) => {
        sent.push({ method: 'PUT', body: JSON.parse(init.body as string) });
        return { status: 200, body: { lineup: SAVED } };
      },
    });
    renderAt('/p', <PlannerPage teamId={TEAM_ID} />);

    const name = await screen.findByRole('textbox', { name: 'Nombre' });
    await userEvent.clear(name);
    await userEvent.type(name, 'Fecha 3');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar alineación' }));
    expect(await screen.findByRole('status')).toHaveTextContent('Guardada.');
    expect(sent[0]).toMatchObject({
      method: 'POST',
      body: { name: 'Fecha 3', formation: '1-3-3-1' },
    });

    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await vi.waitFor(() => expect(sent).toHaveLength(2));
    expect(sent[1]!.method).toBe('PUT');
  });

  it('la lista y el detalle tal como se guardó, con su desglose', async () => {
    fakeApi({
      ...base,
      [`GET /api/v1/teams/${TEAM_ID}/lineups`]: {
        status: 200,
        body: {
          items: [
            {
              id: LINEUP_ID,
              name: 'Fecha 3',
              matchDate: '2026-11-01',
              matchId: null,
              formation: '1-3-3-1',
              createdBy: { id: uuid(8), name: 'Profe' },
              updatedAt: SAVED.updatedAt,
            },
          ],
        },
      },
      [`GET /api/v1/teams/${TEAM_ID}/lineups/${LINEUP_ID}`]: {
        status: 200,
        body: { lineup: SAVED },
      },
    });
    renderAt('/l', <SavedLineupsPage teamId={TEAM_ID} />, [
      {
        path: '/equipos/:teamId/alineaciones/:lineupId',
        element: <LineupViewPage teamId={TEAM_ID} lineupId={LINEUP_ID} />,
      },
    ]);

    const item = await screen.findByRole('link', { name: /Fecha 3/ });
    expect(item).toHaveTextContent('1 nov 2026, 1-3-3-1, Profe');
    await userEvent.click(item);

    expect(await screen.findByRole('heading', { name: 'Fecha 3' })).toBeInTheDocument();
    expect(screen.getByText(/armada por Profe/)).toBeInTheDocument();
    await userEvent.click(
      await screen.findByRole('button', { name: /^Mediocentro: Meza.*fijado$/ }),
    );
    const detail = screen.getByRole('region', { name: 'Mediocentro' });
    expect(detail).toHaveTextContent('80% de encaje, puesto a mano');
    expect(detail).toHaveTextContent('Testsin dato');
    expect(screen.getByRole('link', { name: 'Editar en el planificador' })).toHaveAttribute(
      'href',
      `/equipos/${TEAM_ID}/planificador?alineacion=${LINEUP_ID}`,
    );
  });

  it('editar la abre tal cual (todos fijados) y guarda los cambios sobre la misma', async () => {
    let put = false;
    fakeApi({
      ...base,
      [`GET /api/v1/teams/${TEAM_ID}/lineups/${LINEUP_ID}`]: {
        status: 200,
        body: { lineup: SAVED },
      },
      [`PUT /api/v1/teams/${TEAM_ID}/lineups/${LINEUP_ID}`]: () => {
        put = true;
        return { status: 200, body: { lineup: SAVED } };
      },
    });
    renderAt(`/p?alineacion=${LINEUP_ID}`, <PlannerPage teamId={TEAM_ID} />);

    expect(await screen.findByText(/Abriste “Fecha 3” tal cual se guardó/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /^Portero: Julio.*fijado$/ })).toBeInTheDocument();
    expect(screen.getByRole('textbox', { name: 'Nombre' })).toHaveValue('Fecha 3');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await vi.waitFor(() => expect(put).toBe(true));
    expect(screen.getByRole('button', { name: 'Guardar como nueva' })).toBeInTheDocument();
  });

  it('borrar pide confirmación', async () => {
    let deleted = false;
    fakeApi({
      ...base,
      [`GET /api/v1/teams/${TEAM_ID}/lineups/${LINEUP_ID}`]: {
        status: 200,
        body: { lineup: SAVED },
      },
      [`DELETE /api/v1/teams/${TEAM_ID}/lineups/${LINEUP_ID}`]: () => {
        deleted = true;
        return { status: 204 };
      },
      [`GET /api/v1/teams/${TEAM_ID}/lineups`]: { status: 200, body: { items: [] } },
    });
    const router = renderAt('/v', <LineupViewPage teamId={TEAM_ID} lineupId={LINEUP_ID} />, [
      { path: '/equipos/:teamId/alineaciones', element: <SavedLineupsPage teamId={TEAM_ID} /> },
    ]);
    await userEvent.click(await screen.findByRole('button', { name: 'Borrar' }));
    expect(deleted).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Sí, borrarla' }));
    await vi.waitFor(() =>
      expect(router.state.location.pathname).toBe(`/equipos/${TEAM_ID}/alineaciones`),
    );
    expect(deleted).toBe(true);
    expect(await screen.findByText(/Todavía no guardaste ninguna/)).toBeInTheDocument();
  });
});
