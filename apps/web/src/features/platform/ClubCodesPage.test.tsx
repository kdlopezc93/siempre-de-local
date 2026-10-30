import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fakeApi } from '../../test/fake-api';
import { ME_TWO_TEAMS } from '../../test/me-two-teams';
import { ClubCodesPage } from './ClubCodesPage';

const ADMIN = { ...ME_TWO_TEAMS, user: { ...ME_TWO_TEAMS.user, platformAdmin: true } };
const code = (n: number, status: string, extra: object = {}) => ({
  id: `0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6a${n}0`,
  note: null,
  status,
  expiresAt: '2026-11-12T12:00:00.000Z',
  createdAt: '2026-10-29T12:00:00.000Z',
  club: null,
  ...extra,
});

function renderPage(me = ADMIN) {
  render(
    <QueryClientProvider
      client={
        new QueryClient({
          defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
        })
      }
    >
      <MemoryRouter>
        <ClubCodesPage me={me} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('códigos de alta (2026-10-29)', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('crea un código con su nota y lo deja listo para mandar por WhatsApp', async () => {
    let body: unknown;
    let items = [
      code(1, 'used', { note: 'Pedro', club: { id: code(9, '').id, name: 'Los Tigres' } }),
    ];
    fakeApi({
      'GET /api/v1/admin/club-codes': () => ({ status: 200, body: { items } }),
      'POST /api/v1/admin/club-codes': (init) => {
        body = JSON.parse(init.body as string);
        const created = code(2, 'active', { note: 'Juan, Barrio Unido' });
        items = [created, ...items];
        return {
          status: 201,
          body: {
            clubCode: created,
            code: 'K7Q2M9XDAB',
            url: 'https://app.sdl.test/crear-club/K7Q2M9XDAB',
          },
        };
      },
    });
    renderPage();

    expect(await screen.findByText('Creó el club Los Tigres')).toBeInTheDocument();
    await userEvent.type(screen.getByLabelText('¿Para quién es? (opcional)'), 'Juan, Barrio Unido');
    await userEvent.click(screen.getByRole('button', { name: 'Crear código' }));
    expect(await screen.findByRole('heading', { name: 'Tu código está listo' })).toHaveFocus();
    expect(body).toEqual({ note: 'Juan, Barrio Unido' });
    expect(screen.getByLabelText('Código K 7 Q 2 M 9 X D A B')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Compartir por WhatsApp' })).toHaveAttribute(
      'href',
      expect.stringContaining(encodeURIComponent('creas tu club y tu equipo')),
    );
    const list = await screen.findByRole('list');
    expect(await within(list).findByText('Juan, Barrio Unido')).toBeInTheDocument();
  });

  it('anular pide confirmar', async () => {
    const { calls } = fakeApi({
      'GET /api/v1/admin/club-codes': { status: 200, body: { items: [code(3, 'active')] } },
      [`DELETE /api/v1/admin/club-codes/${code(3, '').id}`]: { status: 204 },
    });
    renderPage();
    await userEvent.click(await screen.findByRole('button', { name: 'Anular código' }));
    expect(calls.some((c) => c.startsWith('DELETE'))).toBe(false);
    await userEvent.click(screen.getByRole('button', { name: 'Sí, anular código' }));
    await vi.waitFor(() => expect(calls.some((c) => c.startsWith('DELETE'))).toBe(true));
  });

  it('a quien no administra la plataforma no le muestra nada', () => {
    fakeApi({});
    renderPage(ME_TWO_TEAMS);
    expect(screen.getByRole('alert')).toHaveTextContent('Solo el administrador de la plataforma');
    expect(screen.queryByRole('button', { name: 'Crear código' })).toBeNull();
  });
});
