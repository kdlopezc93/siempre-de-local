import { describe, expect, it } from 'vitest';

import { boardIssues, type ExamBoard } from './exam-board.js';

const BOARD: ExamBoard = {
  view: 'own-half',
  pieces: [
    { side: 'own', x: 50, y: 120, label: '4', you: true },
    { side: 'rival', x: 60, y: 100, label: '9' },
  ],
  ball: { x: 30, y: 90 },
  arrows: [{ kind: 'pass', from: { x: 30, y: 90 }, to: { x: 60, y: 100 } }],
  spots: [
    { x: 20, y: 110 },
    { x: 45, y: 105 },
    { x: 70, y: 112 },
    { x: 50, y: 135 },
  ],
};

describe('pizarra del examen (Fase 8)', () => {
  it('una pizarra bien armada no tiene problemas', () => {
    expect(boardIssues(BOARD, 4)).toEqual([]);
  });

  it('lo que queda fuera de la vista, puntos que faltan o se pisan, y más de un "tú"', () => {
    const problems = boardIssues(
      {
        ...BOARD,
        pieces: [...BOARD.pieces, { side: 'own', x: 50, y: 30, you: true, label: 'LONG' }],
        ball: { x: 50, y: 10 },
        spots: [
          { x: 20, y: 110 },
          { x: 25, y: 112 },
          { x: 70, y: 112 },
        ],
      },
      4,
    );
    expect(problems).toEqual([
      'Hay más de un "tú".',
      'Un jugador queda fuera de la vista (50, 30).',
      'La etiqueta "LONG" va de 1 a 3 caracteres.',
      'El balón queda fuera de la vista.',
      'Tiene 3 puntos de respuesta para 4 opciones.',
      'Los puntos de respuesta 1 y 2 están muy juntos (mínimo 15).',
    ]);
  });

  it('sin puntos de respuesta, la pizarra solo se mira', () => {
    expect(boardIssues({ ...BOARD, spots: undefined }, 4)).toEqual([]);
  });
});
