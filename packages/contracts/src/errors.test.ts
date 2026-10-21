import { describe, expect, it } from 'vitest';

import { ErrorBodySchema } from './errors.js';

describe('ErrorBodySchema', () => {
  it('acepta el formato documentado', () => {
    const body = { error: { code: 'TEAM_NOT_FOUND', message: 'No existe el equipo' } };
    expect(ErrorBodySchema.parse(body)).toEqual(body);
  });

  it('rechaza un error sin código', () => {
    expect(ErrorBodySchema.safeParse({ error: { message: 'x' } }).success).toBe(false);
  });
});
