import { describe, expect, it } from 'vitest';

import { boardSvg } from './board-svg.js';

describe('pizarra en la hoja de revisión', () => {
  it('dibuja la visera solo en las fichas que dicen hacia dónde miran', () => {
    const svg = boardSvg(
      {
        view: 'own-half',
        pieces: [
          { side: 'own', x: 50, y: 120, label: '4', you: true, facing: 0 },
          { side: 'rival', x: 60, y: 95, label: '9' },
        ],
      },
      [],
      null,
    );
    expect(svg.match(/<path d="M[\d.]+,[\d.]+ A5\.6/g)).toHaveLength(1);
  });
});
