import type { Difficulty } from '@sdl/domain';

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
