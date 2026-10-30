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
  kind: 'friendly',
  tournament: null,
  format: 'F11',
  startsAt: future(3),
  place: 'Cancha de La 14',
  opponent: 'Los Pibes',
  status: 'scheduled',
  open: true,
  editable: true,
  createdBy: { id: ME_TWO_TEAMS.user.id, name: 'Kevin' },
  replies: { yes: 3, no: 1, pending: 2, injured: 0 },
  myReply: null,
  published: null,
  result: null,
  myRating: null,
  attendanceTaken: false,
  ...over,
});
const ROSTER = [
  {
    playerId: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6fb1',
    displayName: 'Ana',
    jerseyNumber: 4,
    reply: 'yes',
    canRate: true,
    injured: false,
    // Sin lista, vino el que dijo "voy" (lo calcula el API).
    came: true,
  },
  {
    playerId: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6fb2',
    displayName: 'Beto',
    jerseyNumber: 9,
    reply: 'no',
    canRate: true,
    injured: false,
    came: false,
  },
  {
    playerId: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6fb3',
    displayName: 'Ciro',
    jerseyNumber: null,
    reply: null,
    canRate: true,
    injured: false,
    came: false,
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
              editable: false,
              status: 'cancelled',
              startsAt: future(-10),
            }),
          ],
        },
      },
    });
    renderAt('/p', [{ path: '/p', element: <MatchesPage me={ME_TWO_TEAMS} teamId={TEAM_A} /> }]);
    expect(await screen.findByRole('link', { name: /Convocar/ })).toHaveAttribute(
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
    // El balance cuenta los cancelados aparte.
    const balance = screen.getByRole('region', { name: /Balance/ });
    expect(balance).toHaveTextContent('0 jugados');
    expect(within(balance).getByText('Cancelados').nextElementSibling).toHaveTextContent('1');
  });

  it('ya pasó la hora y no tiene resultado: el cuerpo técnico corrige la hora o lo cancela', async () => {
    const wrong = match({ open: false, startsAt: future(-1) });
    let patch: { startsAt: string } | undefined;
    fakeApi({
      [`GET /api/v1/teams/${TEAM_A}/matches/${M1}`]: {
        status: 200,
        body: { match: wrong, roster: ROSTER },
      },
      [`GET /api/v1/teams/${TEAM_A}/lineups`]: { status: 200, body: { items: [] } },
      [`GET /api/v1/teams/${TEAM_A}/matches/${M1}/ratings`]: { status: 200, body: { items: [] } },
      [`PATCH /api/v1/teams/${TEAM_A}/matches/${M1}`]: (init) => {
        patch = JSON.parse(init.body as string);
        return { status: 200, body: { match: wrong, roster: ROSTER } };
      },
    });
    renderAt('/m', [
      { path: '/m', element: <MatchPage me={ME_TWO_TEAMS} teamId={TEAM_A} matchId={M1} /> },
    ]);
    expect(await screen.findByRole('link', { name: 'Editar el partido' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancelar el partido' })).toBeInTheDocument();

    // Se guardó a la madrugada: se corrige a otra hora del mismo día, aunque ya pasó.
    renderAt('/e', [
      {
        path: '/e',
        element: <MatchFormPage me={ME_TWO_TEAMS} teamId={TEAM_A} matchId={M1} />,
      },
    ]);
    const hour = await screen.findByLabelText('Hora');
    await userEvent.clear(hour);
    await userEvent.type(hour, '13:30');
    // La hora en palabras, para no confundir a. m. con p. m.
    expect(screen.getByText(/^Queda para el .*1:30.*p\.\s?m\./)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Guardar cambios' }));
    await vi.waitFor(() => expect(patch).toBeDefined());
    const sent = new Date(patch!.startsAt);
    expect([sent.getHours(), sent.getMinutes()]).toEqual([13, 30]);
  });

  it('con resultado, ya no se edita ni se cancela', async () => {
    fakeApi({
      [`GET /api/v1/teams/${TEAM_A}/matches/${M1}`]: {
        status: 200,
        body: {
          match: match({
            open: false,
            editable: false,
            startsAt: future(-1),
            result: { goalsFor: 1, goalsAgainst: 0, figure: null, at: future(0) },
          }),
          roster: ROSTER,
        },
      },
      [`GET /api/v1/teams/${TEAM_A}/lineups`]: { status: 200, body: { items: [] } },
      [`GET /api/v1/teams/${TEAM_A}/matches/${M1}/ratings`]: { status: 200, body: { items: [] } },
    });
    renderAt('/m', [
      { path: '/m', element: <MatchPage me={ME_TWO_TEAMS} teamId={TEAM_A} matchId={M1} /> },
    ]);
    expect(await screen.findByRole('region', { name: 'Resultado' })).toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Editar el partido' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Cancelar el partido' })).toBeNull();
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
            match: match({ myReply: 'yes', replies: { yes: 4, no: 1, pending: 1, injured: 0 } }),
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

  it('el lesionado que no respondió no "falta": va en su grupo, con la marca', async () => {
    fakeApi({
      [`GET /api/v1/teams/${TEAM_A}/matches/${M1}`]: {
        status: 200,
        body: {
          match: match({ replies: { yes: 1, no: 1, pending: 0, injured: 1 } }),
          roster: ROSTER.map((p) => (p.reply === null ? { ...p, injured: true } : p)),
        },
      },
    });
    renderAt('/m', [
      { path: '/m', element: <MatchPage me={ME_TWO_TEAMS} teamId={TEAM_A} matchId={M1} /> },
    ]);
    expect(await screen.findByRole('region', { name: 'Lesionados' })).toHaveTextContent(
      'Ciro, lesionado',
    );
    expect(screen.queryByRole('region', { name: 'Faltan' })).not.toBeInTheDocument();
    expect(screen.getByText('Lesionados', { selector: 'dt' })).toBeInTheDocument();
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
          body: {
            match: match({ status: 'cancelled', open: false, editable: false }),
            roster: ROSTER,
          },
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
    await userEvent.click(screen.getByRole('button', { name: 'Amistoso' }));
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
    expect(body).toMatchObject({
      kind: 'friendly',
      opponent: 'Los Pibes',
      format: 'F11',
      tournamentId: null,
    });
    const sent = new Date(body!.startsAt);
    expect([sent.getHours(), sent.getMinutes()]).toEqual([15, 30]);
  });

  const fillWhenAndWhere = async () => {
    const day = new Date(Date.now() + 3 * 86_400_000);
    const date = `${day.getFullYear()}-${String(day.getMonth() + 1).padStart(2, '0')}-${String(day.getDate()).padStart(2, '0')}`;
    await userEvent.type(screen.getByLabelText('Fecha'), date);
    await userEvent.type(screen.getByLabelText('Hora'), '15:30');
    await userEvent.type(screen.getByRole('textbox', { name: 'Lugar' }), 'Cancha de La 14');
  };

  it('convocar de campeonato: elige el torneo o crea uno nuevo (2026-10-28)', async () => {
    const T1 = '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6fd1';
    let tournament: unknown;
    let body: unknown;
    fakeApi({
      [`GET /api/v1/teams/${TEAM_A}/tournaments`]: { status: 200, body: { items: [] } },
      [`POST /api/v1/teams/${TEAM_A}/tournaments`]: (init) => {
        tournament = JSON.parse(init.body as string);
        return {
          status: 201,
          body: { tournament: { id: T1, name: 'Liga del barrio', createdAt: future(0) } },
        };
      },
      [`POST /api/v1/teams/${TEAM_A}/matches`]: (init) => {
        body = JSON.parse(init.body as string);
        return { status: 201, body: { match: match(), roster: [] } };
      },
    });
    renderAt('/n', [{ path: '/n', element: <MatchFormPage me={ME_TWO_TEAMS} teamId={TEAM_A} /> }]);
    await userEvent.type(screen.getByRole('textbox', { name: 'Rival' }), 'Los Pibes');
    await fillWhenAndWhere();
    // Sin torneos todavía, el campo del nuevo aparece solo; vacío, no deja convocar.
    await userEvent.click(screen.getByRole('button', { name: 'Convocar' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe el nombre del torneo.');
    await userEvent.type(await screen.findByRole('textbox', { name: 'Torneo' }), 'Liga del barrio');
    await userEvent.click(screen.getByRole('button', { name: 'Convocar' }));
    await vi.waitFor(() => expect(body).toBeDefined());
    expect(tournament).toEqual({ name: 'Liga del barrio' });
    expect(body).toMatchObject({ kind: 'championship', tournamentId: T1, opponent: 'Los Pibes' });
  });

  it('convocar a entrenar: sin rival (2026-10-28)', async () => {
    let body: unknown;
    fakeApi({
      [`POST /api/v1/teams/${TEAM_A}/matches`]: (init) => {
        body = JSON.parse(init.body as string);
        return { status: 201, body: { match: match(), roster: [] } };
      },
    });
    renderAt('/n', [{ path: '/n', element: <MatchFormPage me={ME_TWO_TEAMS} teamId={TEAM_A} /> }]);
    await userEvent.click(screen.getByRole('button', { name: 'Entreno' }));
    expect(screen.queryByRole('textbox', { name: 'Rival' })).toBeNull();
    await fillWhenAndWhere();
    await userEvent.click(screen.getByRole('button', { name: 'Convocar' }));
    await vi.waitFor(() => expect(body).toBeDefined());
    expect(body).toMatchObject({ kind: 'training', opponent: null, tournamentId: null });
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

  it('después del partido: el cuerpo técnico carga el resultado con la figura y evalúa (D18)', async () => {
    const ANA = ROSTER[0]!.playerId;
    let result: unknown;
    let rating: unknown;
    const played = match({ open: false, startsAt: future(-1) });
    fakeApi({
      [`GET /api/v1/teams/${TEAM_A}/matches/${M1}`]: {
        status: 200,
        body: { match: played, roster: ROSTER },
      },
      [`GET /api/v1/teams/${TEAM_A}/lineups`]: { status: 200, body: { items: [] } },
      [`GET /api/v1/teams/${TEAM_A}/matches/${M1}/ratings`]: { status: 200, body: { items: [] } },
      [`PUT /api/v1/teams/${TEAM_A}/matches/${M1}/result`]: (init) => {
        result = JSON.parse(init.body as string);
        return {
          status: 200,
          body: {
            match: {
              ...played,
              result: {
                goalsFor: 2,
                goalsAgainst: 1,
                figure: { id: ANA, displayName: 'Ana', jerseyNumber: 4 },
                at: future(0),
              },
            },
            roster: ROSTER,
          },
        };
      },
      [`PUT /api/v1/teams/${TEAM_A}/matches/${M1}/ratings/${ANA}`]: (init) => {
        rating = JSON.parse(init.body as string);
        return {
          status: 200,
          body: {
            items: [
              {
                playerId: ANA,
                displayName: 'Ana',
                jerseyNumber: 4,
                rating: 4,
                note: null,
                ratedBy: { id: ME_TWO_TEAMS.user.id, name: 'Kevin' },
                ratedAt: future(0),
              },
            ],
          },
        };
      },
    });
    const user = userEvent.setup();
    renderAt('/p', [
      { path: '/p', element: <MatchPage me={ME_TWO_TEAMS} teamId={TEAM_A} matchId={M1} /> },
    ]);

    const board = await screen.findByRole('region', { name: 'Resultado' });
    await user.click(within(board).getByRole('button', { name: 'Un gol más para Primer equipo' }));
    await user.click(within(board).getByRole('button', { name: 'Un gol más para Primer equipo' }));
    await user.click(within(board).getByRole('button', { name: 'Un gol más para Los Pibes' }));
    expect(within(board).getByRole('group', { name: 'Goles de Primer equipo' })).toHaveTextContent(
      '2',
    );
    // Con el marcador sin guardar, volver a Partidos pregunta.
    await user.click(screen.getByRole('link', { name: 'Partidos' }));
    expect(await screen.findByRole('heading', { name: '¿Salir sin guardar?' })).toBeVisible();
    await user.click(screen.getByRole('button', { name: 'Seguir aquí' }));
    await user.click(within(board).getByRole('button', { name: 'Elegir' }));
    await user.click(await screen.findByRole('button', { name: /Ana/ }));
    await user.click(within(board).getByRole('button', { name: 'Guardar el resultado' }));
    await vi.waitFor(() =>
      expect(result).toEqual({ goalsFor: 2, goalsAgainst: 1, figurePlayerId: ANA }),
    );
    expect(await within(board).findByText(/Resultado guardado/)).toBeInTheDocument();

    // Sin alineación publicada, se evalúa a los que dijeron "voy"; el resto, para agregar.
    const ratings = screen.getByRole('region', { name: 'Cómo jugó cada uno' });
    expect(within(ratings).queryByRole('group', { name: 'Cómo jugó Beto' })).toBeNull();
    const ana = within(ratings).getByRole('group', { name: 'Cómo jugó Ana' });
    await user.click(within(ana).getByRole('button', { name: 'Muy bien' }));
    await vi.waitFor(() => expect(rating).toEqual({ rating: 4, note: null }));
    expect(await within(ana).findByRole('button', { name: 'Muy bien' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    expect(within(ratings).getByText('1 de 1')).toBeInTheDocument();
  });

  it('¿quién vino?: arranca con los que dijeron voy; la lista guardada decide a quién evaluar', async () => {
    const [ANA, BETO] = [ROSTER[0]!.playerId, ROSTER[1]!.playerId];
    let sent: unknown;
    const played = match({ open: false, startsAt: future(-1) });
    fakeApi({
      [`GET /api/v1/teams/${TEAM_A}/matches/${M1}`]: {
        status: 200,
        body: { match: played, roster: ROSTER },
      },
      [`GET /api/v1/teams/${TEAM_A}/lineups`]: { status: 200, body: { items: [] } },
      [`GET /api/v1/teams/${TEAM_A}/matches/${M1}/ratings`]: { status: 200, body: { items: [] } },
      [`PUT /api/v1/teams/${TEAM_A}/matches/${M1}/attendance`]: (init) => {
        sent = JSON.parse(init.body as string);
        const ids = (sent as { playerIds: string[] }).playerIds;
        return {
          status: 200,
          body: {
            match: { ...played, attendanceTaken: true },
            roster: ROSTER.map((p) => ({ ...p, came: ids.includes(p.playerId) })),
          },
        };
      },
    });
    const user = userEvent.setup();
    renderAt('/p', [
      { path: '/p', element: <MatchPage me={ME_TWO_TEAMS} teamId={TEAM_A} matchId={M1} /> },
    ]);

    const list = await screen.findByRole('region', { name: '¿Quién vino?' });
    expect(within(list).getByRole('checkbox', { name: /Ana/ })).toBeChecked();
    expect(within(list).getByRole('checkbox', { name: /Beto/ })).not.toBeChecked();
    expect(within(list).getByText('1 de 3')).toBeInTheDocument();

    // Beto dijo que no, pero llegó.
    await user.click(within(list).getByRole('checkbox', { name: /Beto/ }));
    expect(within(list).getByText('2 de 3')).toBeInTheDocument();
    await user.click(within(list).getByRole('button', { name: 'Guardar la lista' }));
    await vi.waitFor(() => expect(sent).toEqual({ playerIds: [ANA, BETO] }));

    expect(await within(list).findByText(/Lista guardada/)).toBeInTheDocument();
    const ratings = screen.getByRole('region', { name: 'Cómo jugó cada uno' });
    expect(await within(ratings).findByRole('group', { name: 'Cómo jugó Beto' })).toBeVisible();
    expect(within(list).queryByRole('button', { name: 'Guardar la lista' })).toBeNull();
  });

  it('a quien no evalúa (otro asistente) lo muestra sin las cinco palabras (04 §2.2)', async () => {
    const played = match({ open: false, startsAt: future(-1) });
    fakeApi({
      [`GET /api/v1/teams/${TEAM_A}/matches/${M1}`]: {
        status: 200,
        body: { match: played, roster: [{ ...ROSTER[0]!, canRate: false }] },
      },
      [`GET /api/v1/teams/${TEAM_A}/lineups`]: { status: 200, body: { items: [] } },
      [`GET /api/v1/teams/${TEAM_A}/matches/${M1}/ratings`]: { status: 200, body: { items: [] } },
    });
    renderAt('/p', [
      { path: '/p', element: <MatchPage me={ME_TWO_TEAMS} teamId={TEAM_A} matchId={M1} /> },
    ]);

    const ratings = await screen.findByRole('region', { name: 'Cómo jugó cada uno' });
    expect(
      await within(ratings).findByText('A los asistentes los valora el entrenador.'),
    ).toBeInTheDocument();
    expect(within(ratings).queryByRole('button', { name: 'Muy bien' })).not.toBeInTheDocument();
  });

  it('el jugador ve el resultado, la figura y cómo jugó; ya no se responde (D18)', async () => {
    fakeApi({
      [`GET /api/v1/teams/${TEAM_B}/matches/${M1}`]: {
        status: 200,
        body: {
          match: match({
            open: false,
            editable: false,
            startsAt: future(-1),
            myReply: 'yes',
            result: {
              goalsFor: 3,
              goalsAgainst: 3,
              figure: { id: ME_TWO_TEAMS.user.id, displayName: 'Kevin', jerseyNumber: 10 },
              at: future(0),
            },
            myRating: 4,
          }),
          roster: null,
        },
      },
    });
    renderAt('/p', [
      { path: '/p', element: <MatchPage me={ME_TWO_TEAMS} teamId={TEAM_B} matchId={M1} /> },
    ]);
    const board = await screen.findByRole('region', { name: 'Resultado' });
    expect(within(board).getByRole('group', { name: 'Goles de Los del jueves' })).toHaveTextContent(
      '3',
    );
    expect(within(board).queryByRole('button')).toBeNull();
    expect(within(board).getByText('¡Fuiste la figura del partido!')).toBeInTheDocument();
    expect(within(board).getByText('Muy bien')).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Voy' })).toBeNull();
  });
});
