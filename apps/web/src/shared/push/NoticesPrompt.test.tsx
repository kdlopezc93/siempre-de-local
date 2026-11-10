import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';

import type { PushState } from './push';
import { NoticesPrompt } from './NoticesPrompt';

const push = vi.hoisted(() => ({ state: 'off' as PushState, enable: vi.fn() }));
vi.mock('./push', () => ({
  pushState: async () => push.state,
  enablePush: async () => {
    push.enable();
    return 'on';
  },
  disablePush: async () => 'off',
}));

function renderPrompt(child?: string) {
  const client = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  render(
    <QueryClientProvider client={client}>
      <NoticesPrompt {...(child ? { child } : {})} />
    </QueryClientProvider>,
  );
}

describe('"Activa los avisos" (2026-11-10)', () => {
  beforeEach(() => push.enable.mockReset());

  it('a todos: con los avisos apagados, los activa de un toque y desaparece', async () => {
    push.state = 'off';
    renderPrompt();
    expect(await screen.findByText(/cuando te convoquen/)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: 'Activar avisos' }));
    expect(push.enable).toHaveBeenCalledOnce();
    await waitFor(() =>
      expect(screen.queryByRole('heading', { name: 'Activa los avisos' })).toBeNull(),
    );
  });

  it('al acudiente le habla del niño', async () => {
    push.state = 'off';
    renderPrompt('Sofía');
    expect(await screen.findByText(/cuando convoquen a Sofía/)).toBeInTheDocument();
  });

  it('activados, no sale', async () => {
    push.state = 'on';
    renderPrompt();
    await waitFor(() => expect(screen.queryByText(/Activa los avisos/)).toBeNull());
  });
});
