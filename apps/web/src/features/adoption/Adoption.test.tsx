import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fakeApi } from '../../test/fake-api';
import { TEAM_A } from '../../test/me-two-teams';
import { adoptionSummary, noticesMessage } from './adoption-view';
import { AdoptionPage } from './AdoptionPage';

const player = (n: number, name: string, over: object = {}) => ({
  userId: `0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f${String(n).padStart(2, '0')}`,
  displayName: name,
  jerseyNumber: n,
  seen: 'week',
  notices: true,
  testDone: true,
  repliedLast: true,
  ...over,
});
const PLAYERS = [
  player(4, 'Ana'),
  player(7, 'Pipe', { notices: false }),
  player(9, 'Beto', { seen: 'older', notices: false, testDone: false, repliedLast: false }),
  player(11, 'Ciro', { repliedLast: null }),
];

function renderPage() {
  const router = createMemoryRouter([{ path: '/', element: <AdoptionPage teamId={TEAM_A} /> }]);
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
    >
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

describe('la app en el equipo (2026-11-06)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('las cifras: el lesionado no cuenta para responder', () => {
    expect(adoptionSummary(PLAYERS as never)).toEqual({
      total: 4,
      week: 3,
      notices: 2,
      tests: 3,
      replied: 2,
      answerable: 3,
    });
  });

  it('el mensaje de los avisos: cómo activarlos, quiénes faltan y el enlace', () => {
    expect(noticesMessage(['Pipe', 'Beto'], 'https://app/cuenta').split('\n')).toEqual([
      expect.stringMatching(/^📲 \*Activen los avisos de la app\*/),
      'Es en Tu cuenta → Avisos (en iPhone, primero agréguenla al inicio).',
      'Faltan: Pipe y Beto',
      '👉 https://app/cuenta',
    ]);
  });

  it('el tablero: cuántos entraron, a quién recordarle y los botones', async () => {
    let reminded = false;
    fakeApi({
      [`GET /api/v1/teams/${TEAM_A}/adoption`]: {
        status: 200,
        body: {
          players: PLAYERS,
          lastCallUp: {
            id: PLAYERS[0]!.userId,
            opponent: 'Real Bosa',
            startsAt: new Date().toISOString(),
          },
        },
      },
      [`POST /api/v1/teams/${TEAM_A}/test-reminders`]: () => {
        reminded = true;
        return { status: 200, body: { reminded: 1 } };
      },
    });
    renderPage();
    const lead = await screen.findByRole('region', { name: 'Quién usa la app' });
    expect(lead).toHaveTextContent('3 de 4');
    expect(within(lead).getByRole('list', { name: '3 de 4 entraron esta semana' })).toBeVisible();
    expect(screen.getByText('Respondieron la última').nextElementSibling).toHaveTextContent('2/3');

    const noNotices = screen.getByRole('region', { name: 'Sin avisos (2)' });
    expect(noNotices).toHaveTextContent('Pipe');
    expect(noNotices).toHaveTextContent('Beto');
    const ask = screen.getByRole('link', { name: 'Pedirles los avisos en el grupo' });
    const text = new URL(ask.getAttribute('href')!).searchParams.get('text')!;
    expect(text).toContain('Faltan: Pipe y Beto');
    expect(
      screen.getByRole('region', { name: 'No entran hace más de una semana (1)' }),
    ).toHaveTextContent('Beto');

    await userEvent.click(screen.getByRole('button', { name: 'Recordarles el test' }));
    await vi.waitFor(() => expect(reminded).toBe(true));
    expect(await screen.findByRole('button', { name: 'Listo, se lo recordamos' })).toBeVisible();
  });
});
