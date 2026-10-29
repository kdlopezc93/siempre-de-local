import { POLICY_VERSION } from '@sdl/contracts';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { createMemoryRouter, RouterProvider } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fakeApi } from '../../test/fake-api';
import { DEFAULT_PROFILE } from '../../test/me-fixture';
import { CreateClubRoute } from '../auth/SessionRoutes';

const CODE = 'K7Q2M9XDAB';
const TEAM = '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f71';
const USER = {
  id: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f70',
  name: 'Pedro',
  email: 'p@example.com',
  platformAdmin: false,
};
const CONSENT = { policyVersion: POLICY_VERSION, acceptedAt: '2026-10-21T10:00:00.000Z' };
const me = (consent: typeof CONSENT | null) => ({
  status: 200,
  body: { user: USER, consent, teams: [], profile: DEFAULT_PROFILE, clubs: [] },
});
const PREVIEW = { status: 200, body: { expiresAt: '2026-11-12T12:00:00.000Z' } };
const CREATED = {
  status: 201,
  body: { clubId: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f72', teamId: TEAM },
};

function renderAt(path: string) {
  const router = createMemoryRouter(
    [
      { path: '/crear-club/:code?', element: <CreateClubRoute /> },
      { path: '/', element: <p>Inicio</p> },
    ],
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

async function fillForm() {
  await userEvent.type(await screen.findByLabelText('Nombre del club'), 'Los Tigres del Sur');
  await userEvent.type(screen.getByLabelText('Ciudad o barrio'), 'Bosa');
  await userEvent.type(screen.getByLabelText('Nombre del equipo'), 'Tigres');
  await userEvent.click(screen.getByRole('button', { name: 'Veteranos' }));
  await userEvent.click(screen.getByRole('button', { name: 'Fútbol 11' }));
}

describe('crear mi club (2026-10-29)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('sin sesión pide entrar con Google', async () => {
    fakeApi({
      'GET /api/v1/me': { status: 401, body: { error: { code: 'UNAUTHENTICATED', message: 'x' } } },
      [`GET /api/v1/club-codes/${CODE}`]: PREVIEW,
    });
    renderAt(`/crear-club/${CODE}`);
    expect(await screen.findByRole('heading', { name: 'Arma tu club' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Continuar con Google' })).toBeInTheDocument();
  });

  it('llena el club y el equipo, lo crea y lleva a invitar', async () => {
    let body: unknown;
    fakeApi({
      'GET /api/v1/me': me(CONSENT),
      [`GET /api/v1/club-codes/${CODE}`]: PREVIEW,
      'POST /api/v1/clubs': (init) => {
        body = JSON.parse(init.body as string);
        return CREATED;
      },
    });
    renderAt(`/crear-club/${CODE.toLowerCase()}`);
    await fillForm();
    // Sin ciudad no sigue.
    await userEvent.clear(screen.getByLabelText('Ciudad o barrio'));
    await userEvent.click(screen.getByRole('button', { name: 'Crear mi club' }));
    expect(screen.getByRole('alert')).toHaveTextContent('Escribe la ciudad o el barrio.');
    await userEvent.type(screen.getByLabelText('Ciudad o barrio'), 'Bosa');
    await userEvent.click(screen.getByRole('button', { name: 'Crear mi club' }));

    expect(
      await screen.findByRole('heading', { name: '¡Listo, ya tienes tu club!' }),
    ).toBeInTheDocument();
    expect(body).toEqual({
      code: CODE,
      clubName: 'Los Tigres del Sur',
      city: 'Bosa',
      teamName: 'Tigres',
      category: 'Veteranos',
      format: 'F11',
      season: String(new Date().getFullYear()),
      alsoPlays: true,
    });
    expect(screen.getByRole('link', { name: 'Invitar a mi equipo' })).toHaveAttribute(
      'href',
      `/equipos/${TEAM}/invitar`,
    );
  });

  it('sin la política aceptada, la pide antes de crearlo', async () => {
    const { calls } = fakeApi({
      'GET /api/v1/me': me(null),
      [`GET /api/v1/club-codes/${CODE}`]: PREVIEW,
      'POST /api/v1/me/consent': {
        status: 201,
        body: {
          consent: { policyVersion: POLICY_VERSION, acceptedAt: '2026-10-29T10:00:00.000Z' },
        },
      },
      'POST /api/v1/clubs': CREATED,
    });
    renderAt(`/crear-club/${CODE}`);
    await fillForm();
    await userEvent.click(screen.getByRole('button', { name: 'Crear mi club' }));
    expect(screen.getByRole('heading', { name: 'Antes de crear tu club' })).toBeInTheDocument();
    await userEvent.click(screen.getByRole('checkbox', { name: 'Tengo 18 años o más' }));
    await userEvent.click(screen.getByRole('button', { name: 'Acepto y creo mi club' }));
    expect(
      await screen.findByRole('heading', { name: '¡Listo, ya tienes tu club!' }),
    ).toBeInTheDocument();
    expect(calls.filter((c) => c.startsWith('POST'))).toEqual([
      'POST /api/v1/me/consent',
      'POST /api/v1/clubs',
    ]);
  });

  it('un código usado explica qué hacer', async () => {
    fakeApi({
      'GET /api/v1/me': me(CONSENT),
      [`GET /api/v1/club-codes/${CODE}`]: {
        status: 422,
        body: {
          error: {
            code: 'CLUB_CODE_USED',
            message: 'Este código ya se usó para crear un club. Pide uno nuevo.',
          },
        },
      },
    });
    renderAt(`/crear-club/${CODE}`);
    expect(
      await screen.findByRole('heading', { name: 'Este código no sirve' }),
    ).toBeInTheDocument();
    expect(screen.getByText(/ya se usó para crear un club/)).toBeInTheDocument();
  });

  it('sin código en el enlace, lo pide', async () => {
    fakeApi({ 'GET /api/v1/me': me(CONSENT) });
    const router = renderAt('/crear-club');
    await userEvent.type(await screen.findByLabelText('Código de alta'), 'k7q2-m9');
    await userEvent.click(screen.getByRole('button', { name: 'Seguir' }));
    expect(screen.getByText(/10 letras y números/)).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('Código de alta'), 'xdab');
    await userEvent.click(screen.getByRole('button', { name: 'Seguir' }));
    expect(router.state.location.pathname).toBe(`/crear-club/${CODE}`);
  });
});
