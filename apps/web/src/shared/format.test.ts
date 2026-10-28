import { describe, expect, it } from 'vitest';

import { percent } from './format';

describe('percent', () => {
  it('redondea y deja un espacio duro antes del %', () => {
    expect(percent(0.824)).toBe('82\u00a0%');
    expect(percent(0)).toBe('0\u00a0%');
    expect(percent(1)).toBe('100\u00a0%');
  });
});
