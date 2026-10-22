import { afterEach, describe, expect, it, vi } from 'vitest';

import { randomId } from './random-id';

const UUID_V4 = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/;

describe('randomId', () => {
  afterEach(() => vi.unstubAllGlobals());

  it('usa crypto.randomUUID cuando existe', () => {
    expect(randomId()).toMatch(UUID_V4);
  });

  it('sin contexto seguro (no hay randomUUID) arma un UUID v4 con getRandomValues', () => {
    vi.stubGlobal('crypto', { getRandomValues: crypto.getRandomValues.bind(crypto) });
    const ids = new Set(Array.from({ length: 100 }, randomId));
    expect(ids.size).toBe(100);
    for (const id of ids) expect(id).toMatch(UUID_V4);
  });
});
