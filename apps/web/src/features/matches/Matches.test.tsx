import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import type { ReactNode } from 'react';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fakeApi } from '../../test/fake-api';
import { ME_TWO_TEAMS, TEAM_A, TEAM_B } from '../../test/me-two-teams';
import { MatchFormPage } from './MatchFormPage';
import { MatchPage } from './MatchPage';
import { MatchesPage } from './MatchesPage';

const M1 = '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6fa1';
const future = (days: number) => new Date(Date.now() + days * 86_400_000).toISOString();
const match = (over: object = {}) => ({
  id: M1,
  format: 'F11',
  startsAt: future(3),
  place: 'Cancha de La 14',
  opponent: 'Los Pibes',
  status: 'scheduled',
  open: true,
  createdBy: { id: ME_TWO_TEAMS.user.id, name: 'Kevin' },
  replies: { yes: 3, no: 1, pending: 2 },
  myReply: null,
  published: null,
  ...over,
});
const ROSTER = [
  {
    playerId: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6fb1',
    displayName: 'Ana',
    jerseyNumber: 4,
    reply: 'yes',
  },
  {
    playerId: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6fb2',
    displayName: 'Beto',
    jerseyNumber: 9,
    reply: 'no',
  },
  {
    playerId: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6fb3',
    displayName: 'Ciro',
    jerseyNumber: null,
    reply: null,
  },
];

function renderAt(path: string, routes: { path: string; element: ReactNode }[]) {
  const router = createMemoryRouter(
    [...routes, { path: '/equipos/:teamId/partidos/:matchId', element: <p>el partido</p> }],
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

describe('partidos en la app (Fase 7)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('el cuerpo técnico convoca desde la lista y ve cuántos van', async () => {
    fakeApi({
      [`GET /api/v1/teams/${TEAM_A}/matches`]: {
        status: 200,
        body: {
          items: [
            match(),
            match({
              id: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6fa2',
              opponent: 'Veteranos',
              open: false,
              status: 'cancelled',
              startsAt: future(-10),
            }),
          ],
        },
      },
    });
    renderAt('/p', [{ path: '/p', element: <MatchesPage me={ME_TWO_TEAMS} teamId={TEAM_A} /> }]);
    expect(await screen.findByRole('link', { name: /Convocar partido/ })).toHaveAttribute(
      'href',
      `/equipos/${TEAM_A}/partidos/nuevo`,
    );
    const upcoming = await screen.findByRole('region', { name: 'Próximos' });
    // Kevin también es jugador y no respondió: se le pide.
    expect(within(upcoming).getByRole('link', { name: /Los Pibes/ })).toHaveTextContent(
      'Responder',
    );
    expect(screen.getByText('Anteriores (1)')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Alineaciones guardadas' })).toBeInTheDocument();
  });

  it('el jugador responde voy / no voy desde el partido', async () => {
    let body: unknown;
    fakeApi({
      [`GET /api/v1/teams/${TEAM_B}/matches/${M1}`]: {
        status: 200,
        body: { match: match(), roster: null },
      },
      [`PUT /api/v1/teams/${TEAM_B}/matches/${M1}/reply`]: (init) => {
        body = JSON.parse(init.body as string);
        return {
          status: 200,
          body: {
            match: match({ myReply: 'yes', replies: { yes: 4, no: 1, pending: 1 } }),
            roster: null,
          },
        };
      },
    });
    renderAt('/m', [
      { path: '/m', element: <MatchPage me={ME_TWO_TEAMS} teamId={TEAM_B} matchId={M1} /> },
    ]);
    expect(await screen.findByRole('heading', { level: 1, name: 'Los Pibes' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Voy' }));
    expect(body).toEqual({ reply: 'yes' });
    expect(await screen.findByRole('button', { name: 'Voy' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(screen.getByText('Puedes cambiarla hasta la hora del partido.')).toBeInTheDocument();
    // Los compañeros no ven quién respondió qué.
    expect(screen.queryByRole('region', { name: 'Van' })).toBeNull();
  });

  it('el cuerpo técnico ve quién va y puede cancelar', async () => {
    let patch: unknown;
    fakeApi({
      [`GET /api/v1/teams/${TEAM_A}/matches/${M1}`]: {
        status: 200,
        body: { match: match(), roster: ROSTER },
      },
      [`PATCH /api/v1/teams/${TEAM_A}/matches/${M1}`]: (init) => {
        patch = JSON.parse(init.body as string);
        return {
          status: 200,
          body: { match: match({ status: 'cancelled', open: false }), roster: ROSTER },
        };
      },
    });
    renderAt('/m', [
      { path: '/m', element: <MatchPage me={ME_TWO_TEAMS} teamId={TEAM_A} matchId={M1} /> },
    ]);
    expect(await screen.findByRole('region', { name: 'Van' })).toHaveTextContent('Ana');
    expect(screen.getByRole('region', { name: 'Faltan' })).toHaveTextContent('Ciro');
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar el partido' }));
    await userEvent.click(await screen.findByRole('button', { name: 'Sí, cancelarlo' }));
    expect(patch).toEqual({ status: 'cancelled' });
    expect(await screen.findByText('Partido cancelado.')).toBeInTheDocument();
  });

  it('convocar: valida lo que falta y manda la hora con zona', async () => {
    let body: { startsAt: string; opponent: string; format: string } | undefined;
    fakeApi({
      [`POST /api/v1/teams/${TEAM_A}/matches`]: (init) => {
        body = JSON.parse(init.body as string);
        return { status: 201, body: { match: match(), roster: [] } };
      },
    });
    const router = renderAt('/n', [
      { path: '/n', element: <MatchFormPage me={ME_TWO_TEAMS} teamId={TEAM_A} /> },
    ]);
    await userEvent.click(screen.getByRole('button', { name: 'Convocar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Pon la fecha y la hora del partido.');

    const day = new Date(Date.now() + 3 * 86_400_000);
    const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    await userEvent.type(screen.getByRole('textbox', { name: 'Rival' }), 'Los Pibes');
    await userEvent.type(screen.getByLabelText('Fecha'), date);
    await userEvent.type(screen.getByLabelText('Hora'), '15:30');
    await userEvent.type(screen.getByRole('textbox', { name: 'Lugar' }), 'Cancha de La 14');
    await userEvent.click(screen.getByRole('button', { name: 'Convocar' }));
    await vi.waitFor(() =>
      expect(router.state.location.pathname).toBe(`/equipos/${TEAM_A}/partidos/${M1}`),
    );
    expect(body).toMatchObject({ opponent: 'Los Pibes', format: 'F11' });
    const sent = new Date(body!.startsAt);
    expect([sent.getHours(), sent.getMinutes()]).toEqual([15, 30]);
  });

  it('el cuerpo técnico arma la alineación desde el partido y publica una de las guardadas', async () => {
    const L1 = '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6fc1';
    let published: string | undefined;
    fakeApi({
      [`GET /api/v1/teams/${TEAM_A}/matches/${M1}`]: {
        status: 200,
        body: { match: match(), roster: ROSTER },
      },
      [`GET /api/v1/teams/${TEAM_A}/lineups`]: {
        status: 200,
        body: {
          items: [
            {
              id: L1,
              name: 'vs Los Pibes',
              matchDate: null,
              matchId: M1,
              formation: '1-4-3-3',
              createdBy: null,
              updatedAt: '2026-10-23T10:00:00.000Z',
            },
            {
              id: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6fc2',
              name: 'Otra',
              matchDate: null,
              matchId: null,
              formation: '1-4-3-3',
              createdBy: null,
              updatedAt: '2026-10-23T10:00:00.000Z',
            },
          ],
        },
      },
      [`POST /api/v1/teams/${TEAM_A}/lineups/${L1}/publish`]: () => {
        published = L1;
        return { status: 204 };
      },
    });
    renderAt('/m', [
      { path: '/m', element: <MatchPage me={ME_TWO_TEAMS} teamId={TEAM_A} matchId={M1} /> },
    ]);
    const section = await screen.findByRole('region', { name: 'Alineación' });
    // Solo las de este partido.
    expect(await within(section).findByRole('link', { name: 'vs Los Pibes' })).toBeInTheDocument();
    expect(within(section).queryByRole('link', { name: 'Otra' })).toBeNull();
    expect(within(section).getByRole('link', { name: 'Armar otra' })).toHaveAttribute(
      'href',
      `/equipos/${TEAM_A}/planificador?partido=${M1}`,
    );
    await userEvent.click(within(section).getByRole('button', { name: 'Publicar' }));
    await vi.waitFor(() => expect(published).toBe(L1));
  });

  it('el equipo ve la alineación publicada y el jugador sabe dónde juega', async () => {
    const at = new Date(Date.now() - 3_600_000).toISOString();
    const slots = [
      'POR',
      'LAT-1',
      'DFC-1',
      'DFC-2',
      'LAT-2',
      'MCD',
      'MC-1',
      'MC-2',
      'EXT-1',
      'DC',
      'EXT-2',
    ];
    const p = (
      n: number,
      name: string,
      id = `0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f${String(n).padStart(2, '0')}`,
    ) => ({
      id,
      displayName: name,
      jerseyNumber: n,
    });
    fakeApi({
      [`GET /api/v1/teams/${TEAM_B}/matches/${M1}`]: {
        status: 200,
        body: {
          match: match({
            myReply: 'yes',
            published: { lineupId: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6fc1', at },
          }),
          roster: null,
        },
      },
      [`GET /api/v1/teams/${TEAM_B}/matches/${M1}/lineup`]: {
        status: 200,
        body: {
          matchId: M1,
          format: 'F11',
          formation: '1-4-3-3',
          publishedAt: at,
          starters: slots.map((slotId, i) => ({
            slotId,
            // Kevin (quien mira) de lateral izquierdo.
            player:
              slotId === 'LAT-1' ? p(10, 'Kevin', ME_TWO_TEAMS.user.id) : p(i + 20, `Jugador ${i}`),
          })),
          bench: [p(50, 'Beto')],
        },
      },
    });
    renderAt('/m', [
      { path: '/m', element: <MatchPage me={ME_TWO_TEAMS} teamId={TEAM_B} matchId={M1} /> },
    ]);
    expect(await screen.findByText('Eres titular: Lateral por la izquierda.')).toBeInTheDocument();
    expect(
      screen.getByRole('img', {
        name: /^Alineación 1-4-3-3\. Portero: Jugador 0; Lateral por la izquierda: Kevin/,
      }),
    ).toBeInTheDocument();
    expect(screen.getByText('50 Beto')).toBeInTheDocument();
    // Sin encaje ni nada que tocar.
    expect(screen.queryByText(/encaje/)).toBeNull();
  });
});
