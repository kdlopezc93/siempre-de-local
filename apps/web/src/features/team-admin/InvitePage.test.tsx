import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { fakeApi } from '../../test/fake-api';
import { InvitePage } from './InvitePage';

const TEAM_ID = '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f71';
const TEAM = {
  team: {
    id: TEAM_ID,
    name: 'Primer equipo',
    format: 'F11',
    season: '2026',
    club: { id: '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f72', name: 'Los del Barrio' },
  },
  myRoles: ['coach'],
};
const summary = (id: string, status: string, usedCount = 0) => ({
  id,
  role: 'player',
  status,
  expiresAt: '2026-10-28T12:00:00.000Z',
  maxUses: 30,
  usedCount,
  createdAt: '2026-10-21T12:00:00.000Z',
});
const ACTIVE_ID = '0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f80';

function renderPage() {
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false }, mutations: { retry: false } },
  });
  render(
    <QueryClientProvider client={client}>
      <MemoryRouter>
        <InvitePage teamId={TEAM_ID} />
      </MemoryRouter>
    </QueryClientProvider>,
  );
}

describe('InvitePage', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('crea el enlace y lo deja listo para mandar por WhatsApp o copiar', async () => {
    let items = [summary(ACTIVE_ID, 'active', 3)];
    fakeApi({
      [`GET /api/v1/teams/${TEAM_ID}`]: { status: 200, body: TEAM },
      [`GET /api/v1/teams/${TEAM_ID}/invitations`]: () => ({ status: 200, body: { items } }),
      [`POST /api/v1/teams/${TEAM_ID}/invitations`]: () => {
        const invitation = summary('0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f81', 'active');
        items = [invitation, ...items];
        return {
          status: 201,
          body: {
            invitation,
            code: 'K7Q2M9XDAB',
            joinUrl: 'https://app.sdl.test/unirse/K7Q2M9XDAB',
          },
        };
      },
    });
    const writeText = vi.fn().mockResolvedValue(undefined);
    vi.stubGlobal('navigator', { ...navigator, clipboard: { writeText } });
    renderPage();

    expect(await screen.findByText('Primer equipo, de Los del Barrio')).toBeInTheDocument();
    expect(screen.getByText('3 de 30 personas')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Crear enlace' }));
    expect(await screen.findByRole('heading', { name: 'Tu enlace está listo' })).toHaveFocus();
    expect(screen.getByLabelText('Código K 7 Q 2 M 9 X D A B')).toBeInTheDocument();

    const message =
      'Te convoco a Primer equipo (Los del Barrio). Entra con este enlace para unirte: https://app.sdl.test/unirse/K7Q2M9XDAB';
    const whatsapp = screen.getByRole('link', { name: 'Compartir por WhatsApp' });
    expect(whatsapp).toHaveAttribute('href', `https://wa.me/?text=${encodeURIComponent(message)}`);
    expect(whatsapp).toHaveAttribute('rel', 'noopener noreferrer');

    await userEvent.click(screen.getByRole('button', { name: 'Copiar enlace' }));
    expect(writeText).toHaveBeenCalledWith(message);
    expect(await screen.findByRole('button', { name: 'Copiado' })).toBeInTheDocument();
  });

  it('anular pide confirmación antes de llamar al API', async () => {
    let items = [
      summary(ACTIVE_ID, 'active'),
      summary('0192f0c4-7f6b-7c3e-9d1a-2b3c4d5e6f82', 'expired'),
    ];
    const { calls } = fakeApi({
      [`GET /api/v1/teams/${TEAM_ID}`]: { status: 200, body: TEAM },
      [`GET /api/v1/teams/${TEAM_ID}/invitations`]: () => ({ status: 200, body: { items } }),
      [`DELETE /api/v1/teams/${TEAM_ID}/invitations/${ACTIVE_ID}`]: () => {
        items = items.map((i) => (i.id === ACTIVE_ID ? { ...i, status: 'revoked' } : i));
        return { status: 204 };
      },
    });
    renderPage();

    const list = await screen.findByRole('list');
    expect(within(list).getAllByRole('button', { name: 'Anular enlace' })).toHaveLength(1);
    expect(within(list).getByText('Vencido')).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Anular enlace' }));
    expect(calls.some((c) => c.startsWith('DELETE'))).toBe(false);
    expect(screen.getByRole('button', { name: 'Sí, anular enlace' })).toHaveFocus();
    await userEvent.click(screen.getByRole('button', { name: 'Cancelar' }));
    expect(screen.getByRole('button', { name: 'Anular enlace' })).toHaveFocus();

    await userEvent.click(screen.getByRole('button', { name: 'Anular enlace' }));
    await userEvent.click(screen.getByRole('button', { name: 'Sí, anular enlace' }));
    expect(await within(list).findByText('Anulado')).toBeInTheDocument();
    expect(calls.filter((c) => c.startsWith('DELETE'))).toHaveLength(1);
  });

  it('a un jugador le explica que solo el cuerpo técnico invita', async () => {
    fakeApi({
      [`GET /api/v1/teams/${TEAM_ID}`]: { status: 200, body: { ...TEAM, myRoles: ['player'] } },
      [`GET /api/v1/teams/${TEAM_ID}/invitations`]: {
        status: 403,
        body: { error: { code: 'FORBIDDEN', message: 'x' } },
      },
    });
    renderPage();
    expect(await screen.findByRole('alert')).toHaveTextContent(
      'Solo el entrenador y los administradores del club pueden invitar',
    );
  });
});
