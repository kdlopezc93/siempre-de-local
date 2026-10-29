import { describe, expect, it } from 'vitest';

import { cardHeadline } from './card-view';

const positionAverages = { LAT: 61, MCD: 58, MC: 62, MP: 70, EXT: 74, DC: 67 };

describe('cardHeadline (02 §7.4)', () => {
  it('encabeza la elegida y dice la mejor media aparte', () => {
    expect(cardHeadline({ position: 'LAT', positionAverages }, 'F11')).toEqual({
      main: { pos: 'LAT', value: 61 },
      chosen: true,
      best: { pos: 'EXT', value: 74 },
    });
  });

  it('si la elegida es la mejor, no la repite', () => {
    expect(cardHeadline({ position: 'EXT', positionAverages }, 'F11')?.best).toBeNull();
  });

  it('sin elegida (fotos de antes), su mejor media', () => {
    expect(cardHeadline({ position: null, positionAverages }, 'F11')).toEqual({
      main: { pos: 'EXT', value: 74 },
      chosen: false,
      best: null,
    });
  });

  it('en F8, pivote y mediapunta se pliegan en mediocentro y delantero', () => {
    expect(cardHeadline({ position: 'MP', positionAverages }, 'F8')?.main).toEqual({
      pos: 'DC',
      value: 67,
    });
  });

  it('portero sin sus atributos cae en la mejor media', () => {
    expect(cardHeadline({ position: 'POR', positionAverages }, 'F11')?.chosen).toBe(false);
  });

  it('sin medias, nada', () => {
    expect(cardHeadline({ position: 'LAT', positionAverages: {} }, 'F11')).toBeNull();
  });
});
