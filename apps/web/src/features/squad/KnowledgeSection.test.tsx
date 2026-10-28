import type { PlayerKnowledge } from '@sdl/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fakeApi } from '../../test/fake-api';
import { uuid } from '../../test/questionnaire-fixture';
import { KnowledgeSection } from './KnowledgeSection';

const TEAM_ID = uuid(9);
const ANA = uuid(21);
const exam = (n: number, over: object = {}) => ({
  state: 'finished' as const,
  examId: uuid(70 + n),
  position: 'DFC' as const,
  endedBy: 'submit' as const,
  startedAt: '2026-10-10T10:00:00.000Z',
  submittedAt: '2026-10-10T10:15:00.000Z',
  score: 16,
  total: 20,
  pct: 0.8,
  band: 'solid' as const,
  byArea: [],
  nextAttemptAt: '2026-11-09T10:00:00.000Z',
  voided: null,
  superseded: false,
  fromReview: false,
  ...over,
});
const KNOWLEDGE: PlayerKnowledge = {
  positions: [
    {
      position: 'DFC',
      best: { examId: uuid(70), pct: 0.8, band: 'solid', underReview: false },
      review: null,
    },
    {
      position: 'MC',
      best: null,
      review: {
        id: uuid(80),
        position: 'MC',
        reason: 'Queremos verlo en el medio',
        requestedAt: '2026-10-01T10:00:00.000Z',
        dueAt: '2026-10-15T10:00:00.000Z',
        status: 'expired',
        requestedBy: null,
        resolvedExamId: null,
      },
    },
  ],
  exams: [
    exam(0),
    exam(1, { pct: 0.9, band: 'mastery', superseded: true }),
    exam(2, { voided: { reason: 'Lo hizo otra persona', at: '2026-10-11T10:00:00.000Z' } }),
  ],
};

function renderSection(manages = true) {
  render(
    <QueryClientProvider
      client={new QueryClient({ defaultOptions: { mutations: { retry: false } } })}
    >
      <KnowledgeSection teamId={TEAM_ID} playerId={ANA} knowledge={KNOWLEDGE} manages={manages} />
    </QueryClientProvider>,
  );
}

describe('KnowledgeSection', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('muestra el mejor por posición, la re-evaluación vencida y los exámenes con su estado', () => {
    fakeApi({});
    renderSection();
    const [dfc, mc] = screen.getAllByRole('listitem').slice(0, 2);
    expect(dfc).toHaveTextContent('Defensa central80 % Sólido');
    expect(mc).toHaveTextContent('Sin examen');
    expect(mc).toHaveTextContent(/Re-evaluación vencida el 15 oct.*no cuenta en el planificador/);
    expect(mc).toHaveTextContent('“Queremos verlo en el medio”');
    expect(screen.getByText('Reemplazado')).toBeInTheDocument();
    expect(screen.getByText('Anulado: “Lo hizo otra persona”')).toBeInTheDocument();
  });

  it('pedir re-evaluación: valida el motivo y manda posición, motivo y plazo', async () => {
    let body: unknown;
    fakeApi({
      [`POST /api/v1/teams/${TEAM_ID}/players/${ANA}/knowledge-reviews`]: (init) => {
        body = JSON.parse(init.body as string);
        return { status: 201, body: { review: KNOWLEDGE.positions[1]!.review } };
      },
    });
    renderSection();
    const dfc = screen.getAllByRole('listitem')[0]!;
    await userEvent.click(within(dfc).getByRole('button', { name: 'Pedir re-evaluación' }));
    await userEvent.click(
      within(dfc).getAllByRole('button', { name: 'Pedir re-evaluación' }).at(-1)!,
    );
    expect(within(dfc).getByRole('alert')).toHaveTextContent('lo va a leer el jugador');

    await userEvent.type(
      within(dfc).getByRole('textbox', { name: 'Motivo (lo ve el jugador)' }),
      'No aplica lo que sabe',
    );
    const days = within(dfc).getByRole('textbox', { name: 'Plazo para presentarla (días)' });
    await userEvent.clear(days);
    await userEvent.type(days, '7');
    await userEvent.click(
      within(dfc).getAllByRole('button', { name: 'Pedir re-evaluación' }).at(-1)!,
    );
    await vi.waitFor(() =>
      expect(body).toEqual({ position: 'DFC', reason: 'No aplica lo que sabe', dueInDays: 7 }),
    );
  });

  it('anular con motivo y reinicio del mes; cancelar una re-evaluación', async () => {
    let voided: unknown;
    let cancelled = false;
    fakeApi({
      [`POST /api/v1/teams/${TEAM_ID}/cert-exams/${uuid(70)}/void`]: (init) => {
        voided = JSON.parse(init.body as string);
        return { status: 204 };
      },
      [`DELETE /api/v1/teams/${TEAM_ID}/knowledge-reviews/${uuid(80)}`]: () => {
        cancelled = true;
        return { status: 204 };
      },
    });
    renderSection();

    await userEvent.click(screen.getAllByRole('button', { name: 'Anular' })[0]!);
    await userEvent.type(
      screen.getByRole('textbox', { name: '¿Por qué lo anulas? (lo ve el jugador)' }),
      'Lo hizo su hermano',
    );
    await userEvent.click(screen.getByRole('checkbox', { name: /sin esperar el mes/ }));
    await userEvent.click(screen.getByRole('button', { name: 'Anular examen' }));
    await vi.waitFor(() =>
      expect(voided).toEqual({ reason: 'Lo hizo su hermano', resetInterval: true }),
    );

    await userEvent.click(screen.getByRole('button', { name: 'Cancelar la re-evaluación' }));
    expect(cancelled).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Sí, cancelarla' }));
    await vi.waitFor(() => expect(cancelled).toBe(true));
  });

  it('el asistente ve todo pero no anula ni pide re-evaluaciones', () => {
    fakeApi({});
    renderSection(false);
    expect(screen.queryByRole('button', { name: /Anular|re-evaluación/ })).not.toBeInTheDocument();
    expect(screen.getAllByText('Defensa central').length).toBeGreaterThan(0);
  });
});
