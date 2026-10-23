import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fakeApi } from '../../test/fake-api';
import { uuid } from '../../test/questionnaire-fixture';
import { RatePage } from './RatePage';
import { StaffCardPage } from './StaffCardPage';

const TEAM_ID = uuid(9);
const ANA = uuid(21);
const VALUES = { PAC: 80, SHO: 60, PAS: 70, DRI: 75, DEF: 40, PHY: 65 };
const AVERAGES = { LAT: 61, DFC: 56, MCD: 58, MC: 62, MP: 70, EXT: 74, DC: 67 };
const TEAM = {
  team: {
    id: TEAM_ID,
    name: 'Primer equipo',
    format: 'F11',
    formats: ['F11'],
    season: '2026',
    club: { id: uuid(10), name: 'Los del Barrio' },
    ratingsVisibleToPlayers: true,
    matchRatingsVisibleToPlayers: true,
  },
  myRoles: ['coach'],
};
const SQUAD = {
  players: [
    {
      userId: ANA,
      displayName: 'Ana',
      jerseyNumber: 4,
      preferredPositions: ['EXT'],
      test: { status: 'none' },
      latestAssessment: null,
      assessedByMe: false,
      knowledge: [],
      card: null,
    },
  ],
};
const rating = (id: number, ratedAt: string, notes: string | null, values = VALUES) => ({
  id: uuid(id),
  playerId: ANA,
  ratedBy: { id: uuid(8), name: 'Profe' },
  ratedAt,
  source: 'manual',
  notes,
  values,
  positionAverages: AVERAGES,
  formulaVersion: 'rating-formula-v1',
});

function renderRoutes(path: string, routes: { path: string; element: ReactNode }[]) {
  const router = createMemoryRouter(routes, { initialEntries: [path] });
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

describe('tarjeta', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('el cuerpo técnico ve la vigente con sus notas y las fotos anteriores', async () => {
    fakeApi({
      [`GET /api/v1/teams/${TEAM_ID}`]: { status: 200, body: TEAM },
      [`GET /api/v1/teams/${TEAM_ID}/squad`]: { status: 200, body: SQUAD },
      [`GET /api/v1/teams/${TEAM_ID}/players/${ANA}/ratings`]: {
        status: 200,
        body: {
          items: [
            rating(31, '2026-10-21T10:00:00.000Z', 'Mejoró el pase'),
            rating(30, '2026-09-01T10:00:00.000Z', null),
          ],
        },
      },
    });
    renderRoutes('/c', [
      { path: '/c', element: <StaffCardPage teamId={TEAM_ID} playerId={ANA} /> },
    ]);

    expect(await screen.findByRole('heading', { name: 'Ana' })).toBeInTheDocument();
    expect(screen.getByText('“Mejoró el pase”')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Puntuar de nuevo' })).toBeInTheDocument();
    const older = screen.getByRole('region', { name: 'Fotos anteriores' });
    expect(within(older).getAllByRole('listitem')).toHaveLength(1);
    expect(older).toHaveTextContent(/por Profe.*74 Extremo/);
  });

  it('puntuar: arranca de la última foto, muestra el ancla y manda la foto completa', async () => {
    let body: unknown;
    fakeApi({
      [`GET /api/v1/teams/${TEAM_ID}`]: { status: 200, body: TEAM },
      [`GET /api/v1/teams/${TEAM_ID}/squad`]: { status: 200, body: SQUAD },
      [`GET /api/v1/teams/${TEAM_ID}/players/${ANA}/ratings`]: {
        status: 200,
        body: { items: [rating(31, '2026-10-21T10:00:00.000Z', null)] },
      },
      [`POST /api/v1/teams/${TEAM_ID}/players/${ANA}/ratings`]: (init) => {
        body = JSON.parse(init.body as string);
        return { status: 201, body: { rating: rating(32, '2026-10-22T10:00:00.000Z', null) } };
      },
    });
    const router = renderRoutes('/p', [
      { path: '/p', element: <RatePage teamId={TEAM_ID} playerId={ANA} /> },
      { path: '/equipos/:teamId/plantilla/:playerId/tarjeta', element: <p>Tarjeta</p> },
    ]);

    const pace = await screen.findByRole('slider', { name: 'Ritmo' });
    expect(pace).toHaveValue('80');
    expect(pace).toHaveAttribute('aria-valuetext', '80: Destaca claramente en el equipo');

    fireEvent.change(pace, { target: { value: '90' } });
    expect(pace).toHaveAttribute(
      'aria-valuetext',
      '90: Referencia en la categoría en este aspecto',
    );
    // Sin la casilla de portero no se mandan sus atributos.
    expect(screen.queryByRole('slider', { name: 'Estirada' })).not.toBeInTheDocument();

    await userEvent.type(screen.getByRole('textbox', { name: 'Notas (opcional)' }), 'Voló');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar tarjeta' }));
    await vi.waitFor(() =>
      expect(router.state.location.pathname).toBe(`/equipos/${TEAM_ID}/plantilla/${ANA}/tarjeta`),
    );
    expect(body).toEqual({ values: { ...VALUES, PAC: 90 }, notes: 'Voló' });
  });

  it('puntuar de portero suma sus 6 atributos', async () => {
    let body: { values: Record<string, number> } | undefined;
    fakeApi({
      [`GET /api/v1/teams/${TEAM_ID}`]: { status: 200, body: TEAM },
      [`GET /api/v1/teams/${TEAM_ID}/squad`]: { status: 200, body: SQUAD },
      [`GET /api/v1/teams/${TEAM_ID}/players/${ANA}/ratings`]: { status: 200, body: { items: [] } },
      [`POST /api/v1/teams/${TEAM_ID}/players/${ANA}/ratings`]: (init) => {
        body = JSON.parse(init.body as string);
        return { status: 201, body: { rating: rating(32, '2026-10-22T10:00:00.000Z', null) } };
      },
    });
    renderRoutes('/p', [
      { path: '/p', element: <RatePage teamId={TEAM_ID} playerId={ANA} /> },
      { path: '/equipos/:teamId/plantilla/:playerId/tarjeta', element: <p>Tarjeta</p> },
    ]);

    // Sin foto anterior, todo arranca en 60.
    expect(await screen.findByRole('slider', { name: 'Ritmo' })).toHaveValue('60');
    await userEvent.click(screen.getByRole('checkbox', { name: /portero/ }));
    expect(screen.getByRole('slider', { name: 'Estirada' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar tarjeta' }));
    await vi.waitFor(() => expect(body).toBeDefined());
    expect(Object.keys(body!.values)).toHaveLength(12);
  });
});
