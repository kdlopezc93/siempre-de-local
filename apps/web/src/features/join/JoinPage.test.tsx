import { POLICY_VERSION } from '@sdl/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fakeApi } from '../../test/fake-api';
import { JoinRoute } from '../auth/SessionRoutes';
import { DEFAULT_PROFILE } from '../../test/me-fixture';

const CODE = 'K7Q2M9XDAB';
const PREVIEW = {
  team: { id: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f71', name: 'Primer equipo', format: 'F8' },
  club: { name: 'Los del Barrio' },
  role: 'player',
};
const USER = { id: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f70', name: 'Kevin', email: 'k@example.com' };
const CONSENT = { policyVersion: POLICY_VERSION, acceptedAt: '2026-10-21T10:00:00.000Z' };

function renderJoin() {
  const router = createMemoryRouter(
    [
      { path: '/unirse/:code', element: <JoinRoute /> },
      { path: '/', element: <p>Inicio</p> },
    ],
    { initialEntries: [`/unirse/${CODE}`] },
  );
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <RouterProvider router={router} />
    </QueryClientProvider>,
  );
}

const me = (consent: typeof CONSENT | null) => ({
  status: 200,
  body: { user: USER, consent, teams: [], profile: DEFAULT_PROFILE, clubs: [] },
});

describe('JoinPage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sin sesión muestra la convocatoria y pide entrar con Google', async () => {
    fakeApi({
      'GET /api/v1/me': { status: 401, body: { error: { code: 'UNAUTHENTICATED', message: 'x' } } },
      [`GET /api/v1/invitations/${CODE}`]: { status: 200, body: PREVIEW },
    });
    renderJoin();

    expect(await screen.findByText('Primer equipo')).toBeInTheDocument();
    expect(screen.getByText('Los del Barrio te convoca a')).toBeInTheDocument();
    expect(screen.getByText(/Entras como jugador. El equipo juega fútbol 8/)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar con Google' })).toBeEnabled();
  });

  it('con la política ya aceptada se une con un toque', async () => {
    const { calls } = fakeApi({
      'GET /api/v1/me': me(CONSENT),
      [`GET /api/v1/invitations/${CODE}`]: { status: 200, body: PREVIEW },
      [`POST /api/v1/invitations/${CODE}/accept`]: {
        status: 201,
        body: { teamId: PREVIEW.team.id, role: 'player', alreadyMember: false },
      },
    });
    renderJoin();

    await userEvent.click(await screen.findByRole('button', { name: 'Unirme al equipo' }));
    expect(
      await screen.findByRole('heading', { name: 'Ya estás en el equipo' }),
    ).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Ir a mi equipo' })).toHaveAttribute('href', '/');
    expect(calls).not.toContain('POST /api/v1/me/consent');
  });

  it('sin política aceptada: pide la mayoría de edad y acepta antes de unirse', async () => {
    const { calls } = fakeApi({
      'GET /api/v1/me': me(null),
      [`GET /api/v1/invitations/${CODE}`]: { status: 200, body: PREVIEW },
      'POST /api/v1/me/consent': (init) => {
        expect(JSON.parse(init.body as string)).toEqual({
          policyVersion: POLICY_VERSION,
          ageConfirmed: true,
        });
        return { status: 201, body: { consent: CONSENT } };
      },
      [`POST /api/v1/invitations/${CODE}/accept`]: {
        status: 201,
        body: { teamId: PREVIEW.team.id, role: 'player', alreadyMember: false },
      },
    });
    renderJoin();

    await userEvent.click(await screen.findByRole('button', { name: 'Unirme al equipo' }));
    expect(screen.getByRole('heading', { name: 'Antes de unirte' })).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Acepto y me uno' }));
    expect(screen.getByText(/solo para mayores de edad/)).toBeInTheDocument();
    expect(screen.getByRole('checkbox', { name: 'Tengo 18 años o más' })).toHaveFocus();
    expect(calls).not.toContain('POST /api/v1/me/consent');

    // El texto completo se carga al desplegarlo.
    await userEvent.click(screen.getByText('Leer la política completa'));
    expect(await screen.findByText('1. Quién es responsable de tus datos')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('checkbox', { name: 'Tengo 18 años o más' }));
    await userEvent.click(screen.getByRole('button', { name: 'Acepto y me uno' }));
    expect(
      await screen.findByRole('heading', { name: 'Ya estás en el equipo' }),
    ).toBeInTheDocument();
    expect(calls.filter((c) => c.startsWith('POST'))).toEqual([
      'POST /api/v1/me/consent',
      `POST /api/v1/invitations/${CODE}/accept`,
    ]);
  });

  it('un enlace vencido explica qué hacer', async () => {
    fakeApi({
      'GET /api/v1/me': me(CONSENT),
      [`GET /api/v1/invitations/${CODE}`]: {
        status: 422,
        body: {
          error: {
            code: 'INVITATION_EXPIRED',
            message: 'Esta invitación ya venció. Pídele un enlace nuevo a tu entrenador.',
          },
        },
      },
    });
    renderJoin();

    expect(
      await screen.findByRole('heading', { name: 'Este enlace no sirve' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/Pídele un enlace nuevo a tu entrenador/)).toBeInTheDocument();
  });
});
