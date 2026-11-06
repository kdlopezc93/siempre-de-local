import { afterEach, describe, expect, it, vi } from 'vitest';

import { reloadWithLatestVersion } from './app-update';

describe('traer la versión nueva cuando cambió la política (2026-11-06)', () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    sessionStorage.clear();
  });

  it('pide la versión nueva al service worker y recarga; no lo repite en el mismo minuto', async () => {
    const reload = vi.fn();
    const update = vi.fn(async () => {});
    vi.stubGlobal('location', { ...window.location, reload });
    Object.defineProperty(navigator, 'serviceWorker', {
      configurable: true,
      value: {
        getRegistration: async () => ({ update, installing: null, waiting: null }),
        addEventListener: vi.fn(),
      },
    });
    expect(await reloadWithLatestVersion(1_000_000)).toBe(true);
    expect(update).toHaveBeenCalled();
    expect(reload).toHaveBeenCalledTimes(1);
    expect(await reloadWithLatestVersion(1_030_000)).toBe(false);
    expect(reload).toHaveBeenCalledTimes(1);
    expect(await reloadWithLatestVersion(1_070_000)).toBe(true);
  });
});
