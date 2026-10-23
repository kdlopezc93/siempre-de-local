import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { fakeApi } from '../../test/fake-api';
import { ME_TWO_TEAMS, TEAM_A } from '../../test/me-two-teams';
import { HomePage } from './HomePage';

function renderHome() {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <MemoryRouter>
        <HomePage me={ME_TWO_TEAMS} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('HomePage', () => {
  beforeEach(() => localStorage.clear());
  afterEach(() => vi.unstubAllGlobals());

  it('saluda por el primer nombre, sin correo ni cerrar sesión (pasan a Equipo)', () => {
    fakeApi({ 'GET /api/v1/me/attempts': { status: 200, body: { items: [] } } });
    renderHome();
    expect(screen.getByRole('heading', { level: 1, name: 'Hola, Kevin' })).toBeInTheDocument();
    expect(screen.queryByText(/k@example.com/)).toBeNull();
    expect(screen.queryByRole('button', { name: /Cerrar sesión/ })).toBeNull();
  });

  it('si todavía no hizo el test, es lo primero; y los atajos de su rol', async () => {
    fakeApi({ 'GET /api/v1/me/attempts': { status: 200, body: { items: [] } } });
    renderHome();
    expect(await screen.findByRole('link', { name: /Haz tu test de posición/ })).toHaveAttribute(
      'href',
      `/equipos/${TEAM_A}/test`,
    );
    expect(screen.getByRole('link', { name: 'Armar la alineación' })).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Mi tarjeta' })).toBeInTheDocument();
  });
});
