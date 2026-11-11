import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { act, renderHook } from '@testing-library/react';
import type { ReactNode } from 'react';
import { describe, expect, it, vi } from 'vitest';

const calls: string[] = [];
vi.mock('../../shared/push/push', () => ({
  forgetThisDevice: vi.fn(async () => void calls.push('forget')),
}));
vi.mock('../../shared/api/auth', () => ({
  fetchMe: vi.fn(),
  startGoogleSignIn: vi.fn(),
  signOut: vi.fn(async () => void calls.push('signOut')),
  signOutEverywhere: vi.fn(async () => void calls.push('signOutEverywhere')),
}));
vi.mock('../../shared/offline/api-cache', () => ({ clearApiCache: vi.fn(async () => {}) }));

import { useSignOut, useSignOutEverywhere } from './use-session';

const wrapper = ({ children }: { children: ReactNode }) => (
  <QueryClientProvider client={new QueryClient()}>{children}</QueryClientProvider>
);

describe('cerrar sesión (auditoría 2026-11-11)', () => {
  it.each([
    ['useSignOut', useSignOut, 'signOut'],
    ['useSignOutEverywhere', useSignOutEverywhere, 'signOutEverywhere'],
  ] as const)('%s desuscribe este celular antes de cerrar', async (_name, hook, end) => {
    calls.length = 0;
    const { result } = renderHook(() => hook(), { wrapper });
    await act(() => result.current.mutateAsync());
    expect(calls).toEqual(['forget', end]);
  });
});
