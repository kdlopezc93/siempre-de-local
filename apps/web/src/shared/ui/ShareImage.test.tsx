import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { ShareImage } from './ShareImage';

const file = new File(['png'], 'mi-tarjeta.png', { type: 'image/png' });

function renderShare() {
  render(
    <QueryClientProvider client={new QueryClient()}>
      <ShareImage label="Compartir mi tarjeta" queryKey={['t']} draw={async () => file} />
    </QueryClientProvider>,
  );
}

describe('compartir un afiche (2026-11-06)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    Reflect.deleteProperty(navigator, 'canShare');
    Reflect.deleteProperty(navigator, 'share');
  });

  it('en el celular abre el menú de compartir con la imagen', async () => {
    const share = vi.fn(async () => {});
    Object.assign(navigator, { canShare: () => true, share });
    renderShare();
    await userEvent.click(await screen.findByRole('button', { name: 'Compartir mi tarjeta' }));
    expect(share).toHaveBeenCalledWith({ files: [file] });
  });

  it('en el computador (sin menú de compartir) la descarga', async () => {
    vi.stubGlobal(
      'URL',
      Object.assign(URL, { createObjectURL: () => 'blob:x', revokeObjectURL: () => {} }),
    );
    renderShare();
    const link = await screen.findByRole('link', { name: 'Compartir mi tarjeta' });
    expect(link).toHaveAttribute('download', 'mi-tarjeta.png');
    expect(link).toHaveAttribute('href', 'blob:x');
  });
});
