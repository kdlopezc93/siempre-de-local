import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fakeApi } from '../../test/fake-api';
import { TEAM_A } from '../../test/me-two-teams';
import { TeamMembers } from './TeamMembers';

const ANA = '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6fb1';
const MEMBERS = {
  staff: [
    { userId: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6fc1', displayName: 'Kevin López', role: 'coach' },
    {
      userId: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6fc2',
      displayName: 'Juan Pérez',
      role: 'assistant',
    },
  ],
  players: [
    {
      userId: ANA,
      displayName: 'Ana',
      jerseyNumber: 4,
      bestBand: { position: 'DFC', band: 'solid' },
    },
    {
      userId: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6fb2',
      displayName: 'Ciro',
      jerseyNumber: null,
      bestBand: null,
    },
  ],
};

function renderMembers(opensSheet: boolean) {
  fakeApi({ [`GET /api/v1/teams/${TEAM_A}/members`]: { status: 200, body: MEMBERS } });
  render(
    <QueryClientProvider client={new QueryClient()}>
      <MemoryRouter>
        <TeamMembers teamId={TEAM_A} opensSheet={opensSheet} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('integrantes (07 §4.6, D11)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('el jugador ve a todos, con la mejor banda de cada compañero y sin abrir fichas', async () => {
    renderMembers(false);
    expect(await screen.findByRole('heading', { name: 'Integrantes (4)' })).toBeInTheDocument();
    const staff = screen.getByRole('list', { name: 'Cuerpo técnico' });
    expect(within(staff).getByText('Entrenador')).toBeInTheDocument();
    expect(within(staff).getByText('Asistente')).toBeInTheDocument();
    const players = screen.getByRole('list', { name: 'Jugadores' });
    expect(within(players).getByText('Sólido en Defensa central')).toBeInTheDocument();
    expect(within(players).queryByRole('link')).toBeNull();
  });

  it('el cuerpo técnico abre la ficha de cada jugador', async () => {
    renderMembers(true);
    const players = await screen.findByRole('list', { name: 'Jugadores' });
    expect(within(players).getByRole('link', { name: /Ana/ })).toHaveAttribute(
      'href',
      `/equipos/${TEAM_A}/plantilla/${ANA}`,
    );
  });
});
