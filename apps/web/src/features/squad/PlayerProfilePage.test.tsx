import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fakeApi } from '../../test/fake-api';
import { uuid } from '../../test/questionnaire-fixture';
import { AssessPage } from './AssessPage';
import { PlayerProfilePage } from './PlayerProfilePage';

const TEAM_ID = uuid(9);
const ANA = uuid(21);
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
const assessment = (primaryPosition: string, blind: boolean, id: number) => ({
  id: uuid(id),
  playerId: ANA,
  assessor: { id: uuid(8), name: 'Profe' },
  primaryPosition,
  secondaryPositions: [],
  confidence: 4,
  blind,
  notes: blind ? 'Gana por arriba' : null,
  createdAt: '2026-10-21T10:00:00.000Z',
});
const RANKING = [
  { pos: 'DFC', pct: 0.82 },
  { pos: 'MCD', pct: 0.7 },
  { pos: 'LAT', pct: 0.61 },
  { pos: 'POR', pct: 0.3 },
  { pos: 'MC', pct: 0.25 },
  { pos: 'MP', pct: 0.2 },
  { pos: 'EXT', pct: 0.1 },
  { pos: 'DC', pct: 0.05 },
];
const PROFILE = {
  player: {
    userId: ANA,
    displayName: 'Ana',
    jerseyNumber: 4,
    dominantFoot: 'left',
    playsGoalkeeper: false,
    preferredPositions: ['LAT'],
  },
  test: {
    status: 'visible',
    attemptId: uuid(30),
    submittedAt: '2026-10-20T10:00:00.000Z',
    podium: ['DFC', 'MCD', 'LAT'],
    ranking: RANKING,
  },
  assessments: [assessment('DFC', false, 32), assessment('LAT', true, 31)],
  assessedByMe: true,
  card: null,
  cardCount: 0,
  knowledge: { positions: [], exams: [] },
};

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      {
        path: '/equipos/:teamId/plantilla/:playerId',
        element: <PlayerProfilePage teamId={TEAM_ID} playerId={ANA} />,
      },
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

const routes = (profile: unknown) => ({
  [`GET /api/v1/teams/${TEAM_ID}`]: { status: 200, body: TEAM },
  [`GET /api/v1/teams/${TEAM_ID}/players/${ANA}/profile`]: { status: 200, body: profile },
});

describe('PlayerProfilePage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('la ficha: su ficha y tres datos arriba, valorar y puntuar juntos, y el detalle por secciones', async () => {
    fakeApi(routes(PROFILE));
    const router = renderAt(`/equipos/${TEAM_ID}/plantilla/${ANA}`);

    expect(await screen.findByRole('heading', { level: 1, name: 'Ana' })).toBeInTheDocument();
    expect(screen.getByRole('img', { name: 'Dorsal 4' })).toBeInTheDocument();
    expect(screen.getByText('Zurdo')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Volver a valorar' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Puntuar tarjeta' })).toBeInTheDocument();

    // Resumen (por defecto): dónde lo ven y su test.
    const where = screen.getByRole('region', { name: 'Dónde lo ven' });
    expect(where).toHaveTextContent('Cuerpo técnicoDefensa central');
    expect(where).toHaveTextContent('Sus preferidasLateral');
    expect(where).toHaveTextContent('El test coincide: Defensa central está en su podio.');
    const test = screen.getByRole('region', { name: 'Su test' });
    expect(within(test).getAllByRole('listitem')).toHaveLength(8);
    expect(within(test).getAllByRole('listitem')[0]).toHaveTextContent('Defensa central82%');

    // Las secciones van en la URL.
    await userEvent.click(screen.getByRole('button', { name: 'Valoraciones' }));
    expect(router.state.location.search).toBe('?ver=valoraciones');
    const assessments = screen.getByRole('list', { name: 'Valoraciones' });
    expect(within(assessments).getAllByRole('listitem')).toHaveLength(2);
    expect(within(assessments).getByText('A ciegas')).toBeInTheDocument();
    expect(within(assessments).getByText('“Gana por arriba”')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Tarjeta' }));
    expect(screen.getByText('Todavía nadie del cuerpo técnico lo puntuó.')).toBeInTheDocument();
  });

  it('con el test oculto no hay sección de test ni comparación', async () => {
    fakeApi(
      routes({ ...PROFILE, test: { status: 'hidden' }, assessments: [], assessedByMe: false }),
    );
    renderAt(`/equipos/${TEAM_ID}/plantilla/${ANA}`);

    const where = await screen.findByRole('region', { name: 'Dónde lo ven' });
    expect(where).toHaveTextContent('TestValóralo para verlo');
    expect(screen.getByText('Oculto')).toBeInTheDocument();
    expect(where).not.toHaveTextContent('El test');
    expect(screen.queryByRole('region', { name: 'Su test' })).not.toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Valorar' })).toBeInTheDocument();
  });

  it('valorar desde el perfil vuelve al perfil', async () => {
    fakeApi({
      ...routes(PROFILE),
      [`GET /api/v1/teams/${TEAM_ID}/squad`]: {
        status: 200,
        body: {
          players: [
            {
              userId: ANA,
              displayName: 'Ana',
              jerseyNumber: 4,
              preferredPositions: ['LAT'],
              test: { status: 'none' },
              latestAssessment: null,
              assessedByMe: true,
              knowledge: [],
              card: null,
            },
          ],
        },
      },
      [`POST /api/v1/teams/${TEAM_ID}/assessments`]: {
        status: 201,
        body: { assessment: assessment('DFC', false, 33) },
      },
    });
    const router = renderAt(`/equipos/${TEAM_ID}/plantilla/${ANA}`);

    await userEvent.click(await screen.findByRole('link', { name: 'Volver a valorar' }));
    expect(await screen.findByRole('link', { name: 'Volver a la ficha' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('radio', { name: /Defensa central/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Guardar valoración' }));
    await vi.waitFor(() =>
      expect(router.state.location.pathname).toBe(`/equipos/${TEAM_ID}/plantilla/${ANA}`),
    );
  });

  it('el coach pone el dorsal: valida 0–99 y guarda', async () => {
    let patch: unknown;
    fakeApi({
      ...routes({ ...PROFILE, player: { ...PROFILE.player, jerseyNumber: null } }),
      [`PATCH /api/v1/teams/${TEAM_ID}/members/${ANA}`]: (init) => {
        patch = JSON.parse(init.body as string);
        return { status: 204 };
      },
    });
    renderAt(`/equipos/${TEAM_ID}/plantilla/${ANA}`);

    await userEvent.click(await screen.findByRole('button', { name: 'Ponerle dorsal' }));
    const input = screen.getByRole('textbox', { name: 'Dorsal' });
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    expect(input).toHaveAttribute('aria-invalid', 'true');
    expect(screen.getByText('Escribe un número de 0 a 99.')).toBeInTheDocument();

    await userEvent.type(input, '1a0');
    expect(input).toHaveValue('10');
    await userEvent.click(screen.getByRole('button', { name: 'Guardar' }));
    await vi.waitFor(() => expect(patch).toEqual({ jerseyNumber: 10 }));
    expect(await screen.findByRole('button', { name: 'Ponerle dorsal' })).toBeInTheDocument();
  });

  it('el asistente no ve el editor del dorsal', async () => {
    fakeApi({
      ...routes(PROFILE),
      [`GET /api/v1/teams/${TEAM_ID}`]: { status: 200, body: { ...TEAM, myRoles: ['assistant'] } },
    });
    renderAt(`/equipos/${TEAM_ID}/plantilla/${ANA}`);
    expect(await screen.findByRole('heading', { name: 'Ana' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /dorsal/ })).not.toBeInTheDocument();
  });

  it('avisa si el dorsal ya lo usa otro jugador, y deja guardarlo igual', async () => {
    let patch: unknown;
    const squadPlayer = (userId: string, displayName: string, jerseyNumber: number | null) => ({
      userId,
      displayName,
      jerseyNumber,
      preferredPositions: [],
      test: { status: 'none' },
      latestAssessment: null,
      assessedByMe: false,
      knowledge: [],
      card: null,
    });
    fakeApi({
      ...routes(PROFILE),
      [`GET /api/v1/teams/${TEAM_ID}/squad`]: {
        status: 200,
        body: {
          players: [
            squadPlayer(ANA, 'Ana', 4),
            squadPlayer(uuid(22), 'Beto', 10),
            squadPlayer(uuid(23), 'Caro', 10),
          ],
        },
      },
      [`PATCH /api/v1/teams/${TEAM_ID}/members/${ANA}`]: (init) => {
        patch = JSON.parse(init.body as string);
        return { status: 204 };
      },
    });
    renderAt(`/equipos/${TEAM_ID}/plantilla/${ANA}`);

    await userEvent.click(await screen.findByRole('button', { name: 'Cambiar dorsal' }));
    const input = screen.getByRole('textbox', { name: 'Dorsal' });
    // Su propio número no avisa.
    expect(screen.getByText(/Puede repetirse/)).toBeInTheDocument();

    await userEvent.clear(input);
    await userEvent.type(input, '10');
    expect(
      await screen.findByText(
        'El 10 ya lo usa Beto y Caro. Si comparten camiseta, guárdalo igual.',
      ),
    ).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar igual' }));
    await vi.waitFor(() => expect(patch).toEqual({ jerseyNumber: 10 }));
  });
});
