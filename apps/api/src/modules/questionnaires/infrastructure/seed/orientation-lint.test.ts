import { lintOrientation } from '@sdl/domain';
import { describe, expect, it } from 'vitest';

import { ORIENTATION_V2 } from './orientation-v2.content.js';

describe('control de calidad del test publicado (02 §2)', () => {
  it('v2 no tiene errores de estructura (los avisos de cobertura los resuelve v3)', () => {
    expect(lintOrientation(ORIENTATION_V2).filter((i) => i.level === 'error')).toEqual([]);
  });
});
