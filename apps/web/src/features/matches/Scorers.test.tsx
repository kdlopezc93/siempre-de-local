import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fakeApi } from '../../test/fake-api';
import { TEAM_A } from '../../test/me-two-teams';
import { boardRows, Scorers } from './Scorers';

const row = (id: string, name: string, over: object = {}) => ({
  player: { id, displayName: name, jerseyNumber: null },
  goals: 0,
  assists: 0,
  yellow: 0,
  red: 0,
  ...over,
});
const PLAYERS = [
  row('0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f01', 'Santiago', { goals: 7 }),
  row('0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f02', 'Pipe', { goals: 3, assists: 4 }),
  row('0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f03', 'Ciro', { yellow: 2, red: 1 }),
  row('0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f04', 'Beto', { yellow: 1 }),
];

describe('goleadores (2026-11-06)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('cada tabla de más a menos, sin los que no tienen; las rojas pesan más', () => {
    expect(boardRows(PLAYERS, 'goals').map((p) => p.player.displayName)).toEqual([
      'Santiago',
      'Pipe',
    ]);
    expect(boardRows(PLAYERS, 'assists').map((p) => p.player.displayName)).toEqual(['Pipe']);
    expect(boardRows(PLAYERS, 'cards').map((p) => p.player.displayName)).toEqual(['Ciro', 'Beto']);
  });

  it('la tabla en Partidos: goles primero; las tarjetas, con su color en palabras', async () => {
    fakeApi({
      [`GET /api/v1/teams/${TEAM_A}/scorers`]: { status: 200, body: { players: PLAYERS } },
    });
    render(
      <QueryClientProvider client={new QueryClient()}>
        <Scorers teamId={TEAM_A} />
      </QueryClientProvider>,
    );
    const section = await screen.findByRole('region', { name: 'Goleadores' });
    const items = within(section).getAllByRole('listitem');
    expect(items[0]).toHaveTextContent('Santiago7');
    await userEvent.click(within(section).getByRole('button', { name: 'Tarjetas' }));
    expect(within(section).getAllByRole('listitem')[0]).toHaveTextContent(
      'Ciro2 amarillas, 1 roja',
    );
  });
});
