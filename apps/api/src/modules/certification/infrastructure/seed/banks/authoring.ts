import type { BoardPoint, Difficulty, ExamBoard } from '@sdl/domain';

import type { CertBankContent } from '../../../application/cert-bank.js';

type Item = CertBankContent['items'][number];

/**
 * Una pregunta del banco: la correcta y los tres distractores por separado, que es como se
 * piensa al escribirla. La correcta se ubica en una posición distinta según la pregunta
 * (en el examen las opciones igual se barajan).
 */
export function q(
  code: string,
  area: string,
  difficulty: Difficulty,
  text: string,
  correct: string,
  wrong: readonly [string, string, string],
  explanation: string,
): Item {
  const at = [...code].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 4;
  const options = wrong.map((label) => ({ label }));
  options.splice(at, 0, { label: correct, correct: true } as { label: string; correct?: boolean });
  return { code, area, difficulty, text, options, explanation };
}

type Spotted = { label: string; spot: BoardPoint };

/**
 * Una pregunta de pizarra (Fase 8): como `q`, pero cada opción trae su punto en la cancha y la
 * jugada va en `board`. Los puntos quedan en el mismo orden que las opciones, que es como los
 * espera el servidor.
 */
export function qb(
  code: string,
  area: string,
  difficulty: Difficulty,
  text: string,
  board: Omit<ExamBoard, 'spots'>,
  correct: Spotted,
  wrong: readonly [Spotted, Spotted, Spotted],
  explanation: string,
): Item {
  const at = [...code].reduce((sum, ch) => sum + ch.charCodeAt(0), 0) % 4;
  const ordered: (Spotted & { correct?: true })[] = [...wrong];
  ordered.splice(at, 0, { ...correct, correct: true });
  return {
    code,
    area,
    difficulty,
    text,
    options: ordered.map(({ label, correct: isCorrect }) =>
      isCorrect ? { label, correct: true } : { label },
    ),
    explanation,
    board: { ...board, spots: ordered.map((o) => o.spot) },
  };
}
