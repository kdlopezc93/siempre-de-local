import { describe, expect, it } from 'vitest';

import { seenBucket } from './adoption.js';

describe('la app en el equipo (2026-11-06)', () => {
  const now = new Date('2026-11-06T20:00:00Z');
  const daysAgo = (n: number) => new Date(now.getTime() - n * 86_400_000);

  it('esta semana: hasta 7 días atrás', () => {
    expect(seenBucket(daysAgo(0), now)).toBe('week');
    expect(seenBucket(daysAgo(7), now)).toBe('week');
    expect(seenBucket(daysAgo(7.01), now)).toBe('older');
  });

  it('sin sesión guardada, antes', () => {
    expect(seenBucket(null, now)).toBe('older');
  });
});
