import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ME_TWO_TEAMS, TEAM_A, TEAM_B } from '../../test/me-two-teams';
import { TeamPage } from './TeamPage';

function renderTeam(teamId: string) {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}
    >
      <MemoryRouter>
        <TeamPage me={ME_TWO_TEAMS} teamId={teamId} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('TeamPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('el equipo, invitar e informe para quien corresponde', () => {
    renderTeam(TEAM_A);
    expect(screen.getByRole('heading', { level: 1, name: 'Primer equipo' })).toBeInTheDocument();
    expect(screen.getByText('Los del Barrio, Fútbol 11, temporada 2026')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Invitar jugadores' })).toHaveAttribute(
      'href',
      `/equipos/${TEAM_A}/invitar`,
    );
    expect(screen.getByRole('link', { name: 'Informe de validación' })).toBeInTheDocument();
  });

  it('cerrar sesión ya no está aquí: va en tu cuenta', () => {
    renderTeam(TEAM_B);
    expect(screen.queryByRole('button', { name: 'Cerrar sesión' })).toBeNull();
    // Ahí es solo jugador, pero como dueño del club puede invitar.
    expect(screen.getByRole('link', { name: 'Invitar jugadores' })).toBeInTheDocument();
  });
});
