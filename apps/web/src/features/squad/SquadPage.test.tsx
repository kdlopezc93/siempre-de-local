import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fakeApi } from '../../test/fake-api';
import { uuid } from '../../test/questionnaire-fixture';
import { AssessPage } from './AssessPage';
import { SquadPage } from './SquadPage';

const TEAM_ID = uuid(9);
const ANA = uuid(21);
const BETO = uuid(22);
const TEAM = {
  team: {
    id: TEAM_ID,
    name: 'Primer equipo',
    format: 'F11',
    season: '2026',
    club: { id: uuid(10), name: 'Los del Barrio' },
  },
  myRoles: ['coach'],
};
const SQUAD = {
  players: [
    {
      userId: ANA,
      displayName: 'Ana',
      jerseyNumber: 4,
      preferredPositions: ['DFC'],
      test: { status: 'hidden' },
      latestAssessment: null,
      assessedByMe: false,
    },
    {
      userId: BETO,
      displayName: 'Beto',
      jerseyNumber: null,
      preferredPositions: [],
      test: {
        status: 'visible',
        attemptId: uuid(30),
        submittedAt: '2026-10-22T10:00:00.000Z',
        podium: ['EXT', 'DC', 'MP'],
      },
      latestAssessment: {
        id: uuid(31),
        playerId: BETO,
        assessor: { id: uuid(8), name: 'Profe' },
        primaryPosition: 'EXT',
        secondaryPositions: ['LAT'],
        confidence: 4,
        blind: true,
        notes: null,
        createdAt: '2026-10-21T10:00:00.000Z',
      },
      assessedByMe: true,
    },
  ],
};

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/equipos/:teamId/plantilla', element: <SquadPage teamId={TEAM_ID} /> },
      {
        path: '/equipos/:teamId/plantilla/:playerId/valorar',
        element: <AssessPage teamId={TEAM_ID} playerId={ANA} />,
      },
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

describe('SquadPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('reparto según el cuerpo técnico, huecos y el test oculto hasta valorar', async () => {
    fakeApi({
      [`GET /api/v1/teams/${TEAM_ID}`]: { status: 200, body: TEAM },
      [`GET /api/v1/teams/${TEAM_ID}/squad`]: { status: 200, body: SQUAD },
    });
    renderAt(`/equipos/${TEAM_ID}/plantilla`);

    expect(await screen.findByText('Primer equipo: 2 jugadores')).toBeInTheDocument();
    expect(screen.getByRole('img', { name: /Reparto según cuerpo técnico/ })).toHaveAccessibleName(
      /Extremo 1/,
    );
    expect(screen.getByText(/^Huecos: Portero, Lateral/)).toBeInTheDocument();
    expect(screen.getByText('1 jugador sin valorar.')).toBeInTheDocument();

    const [ana, beto] = within(screen.getByRole('list')).getAllByRole('article');
    expect(ana).toHaveTextContent('Valóralo para verlo');
    expect(within(ana!).getByRole('link', { name: 'Valorar a Ana' })).toBeInTheDocument();
    expect(beto).toHaveTextContent('Extremo, Delantero centro, Mediapunta');
    expect(
      within(beto!).getByRole('link', { name: 'Volver a valorar a Beto' }),
    ).toBeInTheDocument();

    // Según el test, Ana (oculto) no cuenta.
    await userEvent.click(screen.getByRole('radio', { name: 'Test' }));
    expect(screen.getByText('1 jugador sin test a la vista.')).toBeInTheDocument();
  });

  it('valorar: exige la principal, avisa que es a ciegas y vuelve a la plantilla', async () => {
    let body: unknown;
    fakeApi({
      [`GET /api/v1/teams/${TEAM_ID}`]: { status: 200, body: TEAM },
      [`GET /api/v1/teams/${TEAM_ID}/squad`]: { status: 200, body: SQUAD },
      [`POST /api/v1/teams/${TEAM_ID}/assessments`]: (init) => {
        body = JSON.parse(init.body as string);
        return {
          status: 201,
          body: { assessment: { ...SQUAD.players[1]!.latestAssessment, playerId: ANA } },
        };
      },
    });
    const router = renderAt(`/equipos/${TEAM_ID}/plantilla/${ANA}/valorar`);

    expect(await screen.findByRole('heading', { name: 'Valorar a Ana' })).toBeInTheDocument();
    expect(screen.getByText(/va a ciegas/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Guardar valoración' }));
    expect(screen.getByText('Elige la posición donde más lo ves.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: /Defensa central/ }));
    await userEvent.click(screen.getByRole('button', { name: /Lateral/ }));
    await userEvent.click(screen.getByRole('radio', { name: /Bastante/ }));
    await userEvent.type(
      screen.getByRole('textbox', { name: 'Notas (opcional)' }),
      'Gana por arriba',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Guardar valoración' }));

    await vi.waitFor(() =>
      expect(router.state.location.pathname).toBe(`/equipos/${TEAM_ID}/plantilla`),
    );
    expect(body).toEqual({
      playerId: ANA,
      primaryPosition: 'DFC',
      secondaryPositions: ['LAT'],
      confidence: 4,
      notes: 'Gana por arriba',
    });
  });
});
