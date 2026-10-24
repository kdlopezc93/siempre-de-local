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
      preferredPositions: ['DFC'],
      test: { status: 'hidden' },
      latestAssessment: null,
      assessedByMe: false,
      canRate: true,
      injury: null,
      knowledge: [],
      card: null,
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
      canRate: true,
      injury: null,
      knowledge: [{ position: 'DFC', pct: 0.8, band: 'solid', review: 'expired' }],
      card: { ratedAt: '2026-10-21T10:00:00.000Z', positionAverages: { EXT: 74, DC: 67, LAT: 60 } },
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

  it('una fila por jugador: ficha, posición, lo que falta y su media; lleva a su ficha', async () => {
    fakeApi({
      [`GET /api/v1/teams/${TEAM_ID}`]: { status: 200, body: TEAM },
      [`GET /api/v1/teams/${TEAM_ID}/squad`]: { status: 200, body: SQUAD },
    });
    renderAt(`/equipos/${TEAM_ID}/plantilla`);

    expect(await screen.findByText('2 jugadores')).toBeInTheDocument();
    const [ana, beto] = within(screen.getByRole('list')).getAllByRole('link');
    expect(ana).toHaveAttribute('href', `/equipos/${TEAM_ID}/plantilla/${ANA}`);
    expect(ana).toHaveTextContent('AnaDefensa central');
    expect(ana).toHaveTextContent('Valorar');
    expect(ana).toHaveTextContent('– sin tarjeta');
    expect(beto).toHaveTextContent('BetoExtremo, re-evaluación vencida');
    expect(beto).toHaveTextContent('74 de media');
    // Un solo camino al jugador: nada de "Ver tarjeta" ni "Valorar" sueltos en la lista.
    expect(screen.queryByRole('link', { name: /Tarjeta de/ })).toBeNull();
  });

  it('filtros y búsqueda viven en la URL (los enlaces del inicio llegan filtrados)', async () => {
    fakeApi({
      [`GET /api/v1/teams/${TEAM_ID}`]: { status: 200, body: TEAM },
      [`GET /api/v1/teams/${TEAM_ID}/squad`]: { status: 200, body: SQUAD },
    });
    const router = renderAt(`/equipos/${TEAM_ID}/plantilla?filtro=por-valorar`);

    expect(await screen.findByText('1 de 2')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Por valorar, 1' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await userEvent.click(screen.getByRole('button', { name: 'Por valorar, 1' }));
    expect(screen.getByText('2 jugadores')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Delanteros, 1' }));
    expect(router.state.location.search).toBe('?filtro=ataque');
    await userEvent.type(screen.getByRole('searchbox', { name: 'Buscar jugador' }), 'ana');
    expect(screen.getByText('Nadie con esa búsqueda o esos filtros.')).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Ver a todos' }));
    expect(router.state.location.search).toBe('');
  });

  it('la pizarra: reparto según la fuente, huecos y el test oculto hasta valorar', async () => {
    fakeApi({
      [`GET /api/v1/teams/${TEAM_ID}`]: { status: 200, body: TEAM },
      [`GET /api/v1/teams/${TEAM_ID}/squad`]: { status: 200, body: SQUAD },
    });
    renderAt(`/equipos/${TEAM_ID}/plantilla?vista=pizarra`);

    expect(
      await screen.findByRole('img', { name: /Reparto según cuerpo técnico/ }),
    ).toHaveAccessibleName(/Extremo: Beto/);
    expect(screen.getByText(/^Huecos: Portero, Lateral/)).toBeInTheDocument();
    expect(screen.getByText('1 jugador sin valorar.')).toBeInTheDocument();
    // Según el test, Ana (oculto) no cuenta.
    await userEvent.click(screen.getByRole('button', { name: 'Test' }));
    expect(screen.getByText('1 jugador sin test a la vista.')).toBeInTheDocument();
  });

  it('descarga la plantilla en CSV con el nombre que propone el API', async () => {
    const { fetchMock } = fakeApi({});
    fetchMock.mockImplementation((input: URL | string) => {
      const path = new URL(input).pathname;
      if (path.endsWith('/export.csv')) {
        return Promise.resolve(
          new Response('"Nombre"\r\n', {
            headers: {
              'content-type': 'text/csv',
              'content-disposition': 'attachment; filename="plantilla-primer-equipo.csv"',
            },
          }),
        );
      }
      return Promise.resolve(
        new Response(JSON.stringify(path.endsWith('/squad') ? SQUAD : TEAM), {
          headers: { 'content-type': 'application/json' },
        }),
      );
    });
    const original = { create: URL.createObjectURL, revoke: URL.revokeObjectURL };
    URL.createObjectURL = () => 'blob:x';
    URL.revokeObjectURL = () => {};
    const saved: string[] = [];
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(function (
      this: HTMLAnchorElement,
    ) {
      saved.push(this.download);
    });
    renderAt(`/equipos/${TEAM_ID}/plantilla`);

    await userEvent.click(
      await screen.findByRole('button', { name: 'Descargar la plantilla (CSV)' }),
    );
    await vi.waitFor(() => expect(saved).toEqual(['plantilla-primer-equipo.csv']));
    URL.createObjectURL = original.create;
    URL.revokeObjectURL = original.revoke;
    vi.restoreAllMocks();
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
