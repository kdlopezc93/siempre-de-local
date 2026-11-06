import { render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';

import { TestEnvBanner } from './TestEnvBanner';

describe('la franja de pruebas (2026-11-06)', () => {
  it('en el túnel y en local dice dónde estás', () => {
    const { unmount } = render(<TestEnvBanner mode="tunnel" />);
    expect(screen.getByRole('note')).toHaveTextContent('Pruebas: túnel· no es la app del equipo');
    unmount();
    render(<TestEnvBanner mode="development" />);
    expect(screen.getByRole('note')).toHaveTextContent('Pruebas: local');
  });

  it('en staging no sale', () => {
    render(<TestEnvBanner mode="production" />);
    expect(screen.queryByRole('note')).toBeNull();
  });
});
