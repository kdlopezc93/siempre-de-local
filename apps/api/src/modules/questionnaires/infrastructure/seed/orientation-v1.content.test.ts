import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';

import { describe, expect, it } from 'vitest';

// @ts-expect-error -- script .mjs sin tipos; solo se usa en este test.
import { extract, render } from '../../../../../scripts/extract-prototype-content.mjs';

describe('paridad del contenido v1 con el prototipo', () => {
  it('orientation-v1.content.ts es exactamente lo que se extrae de detector-posicion.jsx', () => {
    const file = readFileSync(
      fileURLToPath(new URL('./orientation-v1.content.ts', import.meta.url)),
      'utf8',
    );
    expect(file).toBe((render as (c: unknown) => string)((extract as () => unknown)()));
  });
});
