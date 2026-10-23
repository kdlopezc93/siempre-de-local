import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fakeApi } from '../../test/fake-api';
import { uuid } from '../../test/questionnaire-fixture';
import { PlannerPage } from './PlannerPage';

const TEAM_ID = uuid(9);
const TEAM = {
  team: {
    id: TEAM_ID,
    name: 'Los de la cuadra',
    format: 'F8',
    formats: ['F8'],
    season: '2026',
    club: { id: uuid(10), name: 'Los del Barrio' },
    photoUrl: null,
    ratingsVisibleToPlayers: true,
  },
  myRoles: ['coach'],
};
const player = (n: number, name: string, primary: string, extra: object = {}) => ({
  playerId: uuid(20 + n),
  displayName: name,
  jerseyNumber: n,
  preferredPositions: [],
  assessment: { primary, secondary: [] },
  rating: { [primary]: 80 },
  ...extra,
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
  player(14, 'Brayan', 'MC', { rating: { MC: 50 } }),
];

function renderPlanner(
  players = PLAYERS,
  format: 'F8' | 'F11' = 'F8',
  formats: ('F8' | 'F11')[] = [format],
) {
  fakeApi({
    [`GET /api/v1/teams/${TEAM_ID}`]: {
      status: 200,
      body: { ...TEAM, team: { ...TEAM.team, format, formats } },
    },
    [`GET /api/v1/teams/${TEAM_ID}/lineup-inputs`]: { status: 200, body: { format, players } },
  });
  const router = createMemoryRouter([{ path: '/p', element: <PlannerPage teamId={TEAM_ID} /> }], {
    initialEntries: ['/p'],
  });
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const slot = (name: RegExp) => screen.getByRole('button', { name });

describe('planificador', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('arma la alineación con la formación por defecto y deja suplente al que encaja peor', async () => {
    renderPlanner();
    expect(await screen.findByRole('group', { name: 'Alineación 1-3-3-1' })).toBeInTheDocument();
    expect(slot(/^Portero: Julio, encaje \d+%$/)).toBeInTheDocument();
    expect(slot(/^Mediocentro: Julián/)).toBeInTheDocument();
    const bench = screen.getByRole('region', { name: 'Suplentes (1)' });
    expect(within(bench).getByRole('button', { name: /Brayan/ })).toBeInTheDocument();
    expect(screen.getByText('Convocatoria: 9 de 9')).toBeInTheDocument();
  });

  it('el detalle de un puesto muestra el desglose; intercambiar dos los deja fijados', async () => {
    renderPlanner();
    await userEvent.click(await screen.findByRole('button', { name: /^Mediocentro: Julián/ }));
    const detail = screen.getByRole('region', { name: 'Mediocentro' });
    expect(detail).toHaveTextContent('Cuerpo técnico');
    expect(detail).toHaveTextContent('Testsin dato');
    expect(screen.getByText('Toca otro puesto para intercambiarlos.')).toBeInTheDocument();

    await userEvent.click(slot(/^Delantero centro: Daniel/));
    expect(slot(/^Mediocentro: Daniel.*fijado$/)).toBeInTheDocument();
    expect(slot(/^Delantero centro: Julián.*fijado$/)).toBeInTheDocument();

    // Soltar el mediocentro lo devuelve al cálculo; Julián sigue fijado de 9.
    await userEvent.click(slot(/^Mediocentro: Daniel/));
    await userEvent.click(screen.getByRole('button', { name: 'Soltar' }));
    expect(slot(/^Mediocentro: (?!.*fijado)/)).toBeInTheDocument();
    expect(slot(/^Delantero centro: Julián.*fijado$/)).toBeInTheDocument();
  });

  it('un suplente entra al puesto que se toque después', async () => {
    renderPlanner();
    const bench = await screen.findByRole('region', { name: 'Suplentes (1)' });
    await userEvent.click(within(bench).getByRole('button', { name: /Brayan/ }));
    expect(screen.getByText('Toca el puesto donde va a jugar Brayan.')).toBeInTheDocument();
    await userEvent.click(slot(/^Mediocentro: Julián/));
    expect(slot(/^Mediocentro: Brayan.*fijado$/)).toBeInTheDocument();
  });

  it('desconvocar y cambiar de formación rearman; si faltan jugadores, avisa', async () => {
    renderPlanner(PLAYERS.slice(0, 6));
    await screen.findByRole('group', { name: 'Alineación 1-3-3-1' });
    expect(screen.getByText('Faltan 2 jugadores para completar la formación.')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: '1-2-4-1' }));
    expect(screen.getByRole('group', { name: 'Alineación 1-2-4-1' })).toBeInTheDocument();

    await userEvent.click(screen.getByText('Convocatoria: 6 de 6'));
    await userEvent.click(screen.getByRole('checkbox', { name: /Julio/ }));
    expect(screen.getByText('Convocatoria: 5 de 6')).toBeInTheDocument();
    expect(slot(/^Portero: (?!Julio)/)).toBeInTheDocument();
  });

  it('con un solo formato no hay que elegirlo (D14)', async () => {
    renderPlanner();
    expect(await screen.findByRole('group', { name: 'Alineación 1-3-3-1' })).toBeInTheDocument();
    expect(screen.queryByRole('radio', { name: 'Fútbol 11' })).toBeNull();
  });

  it('un equipo de F11 que también juega F8 arma un partido de F8: el pivote juega de mediocentro', async () => {
    const players = [
      ...PLAYERS.filter((p) => p.displayName !== 'Julián' && p.displayName !== 'Brayan'),
      player(6, 'Felipe', 'MCD', { rating: { MCD: 85, MC: 78 } }),
    ];
    renderPlanner(players, 'F11', ['F11', 'F8']);
    expect(await screen.findByRole('group', { name: 'Alineación 1-4-3-3' })).toBeInTheDocument();
    expect(slot(/^Pivote: Felipe/)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('radio', { name: 'Fútbol 8' }));
    expect(screen.getByRole('group', { name: 'Alineación 1-3-3-1' })).toBeInTheDocument();
    expect(slot(/^Mediocentro: Felipe/)).toBeInTheDocument();
    expect(screen.getByRole('radio', { name: '1-2-4-1' })).toBeInTheDocument();
  });
});
