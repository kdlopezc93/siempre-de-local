import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fakeApi } from '../../test/fake-api';
import { ResultPage } from './ResultPage';
import { ResultView } from './ResultView';

const PODIUM = [
  { pos: 'DFC', pct: 0.82 },
  { pos: 'MCD', pct: 0.7 },
  { pos: 'LAT', pct: 0.55 },
] as const;

describe('ResultView', () => {
  it('la primera con su dorsal y descripción, y el podio con la afinidad', () => {
    render(<ResultView format="F11" podium={[...PODIUM]} provisional={false} />);

    expect(screen.getByText('Tus 3 posiciones')).toBeInTheDocument();
    expect(screen.getByRole('heading', { level: 1, name: 'Defensa central' })).toBeInTheDocument();
    expect(screen.getByText('El muro')).toBeInTheDocument();

    const rows = within(screen.getByRole('list')).getAllByRole('listitem');
    expect(rows.map((row) => row.textContent)).toEqual([
      '1Defensa central82\u00a0%',
      '2Pivote70\u00a0%',
      '3Lateral55\u00a0%',
    ]);
    expect(screen.getByRole('img')).toHaveAccessibleName(
      'Cancha con tus posiciones marcadas: Defensa central, Pivote, Lateral',
    );
  });

  it('marca en la pizarra solo las posiciones del formato', () => {
    const { container } = render(
      <ResultView
        format="F8"
        podium={[
          { pos: 'DC', pct: 0.9 },
          { pos: 'MC', pct: 0.6 },
          { pos: 'EXT', pct: 0.4 },
        ]}
        provisional
      />,
    );
    // F8: 6 posiciones; sin pivote (6) ni mediapunta (10).
    const numbers = [...container.querySelectorAll('svg text')].map((t) => t.textContent);
    expect(numbers).toEqual(['1', '2', '4', '8', '7', '9']);
    expect(screen.getByText('Tu podio provisional')).toBeInTheDocument();
  });
});

describe('ResultPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('carga un resultado oficial guardado', async () => {
    const id = '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f70';
    fakeApi({
      [`GET /api/v1/attempts/${id}`]: {
        status: 200,
        body: {
          attemptId: id,
          clientAttemptId: id,
          teamId: id,
          format: 'F11',
          submittedAt: '2026-10-21T10:00:00.000Z',
          winner: 'EXT',
          ranking: [
            { pos: 'EXT', pct: 0.9 },
            { pos: 'DC', pct: 0.8 },
            { pos: 'MP', pct: 0.6 },
            { pos: 'POR', pct: 0 },
          ],
          podium: ['EXT', 'DC', 'MP'],
          suggestedKnowledgeExams: ['EXT', 'DC', 'MP'],
        },
      },
    });
    render(
      <QueryClientProvider
        client={new QueryClient({ defaultOptions: { queries: { retry: false } } })}
      >
        <MemoryRouter>
          <ResultPage attemptId={id} />
        </MemoryRouter>
      </QueryClientProvider>,
    );
    expect(await screen.findByRole('heading', { level: 1, name: 'Extremo' })).toBeInTheDocument();
    expect(within(screen.getByRole('list')).getAllByRole('listitem')).toHaveLength(3);
  });
});
