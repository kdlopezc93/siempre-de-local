import { SubmitAttemptRequestSchema } from '@sdl/contracts';
import { describe, expect, it } from 'vitest';

import { QUESTIONNAIRE, uuid } from '../../test/questionnaire-fixture';
import { answer, startQuiz, toSubmission, type QuizState } from './quiz-engine';

/** PRNG con semilla (mulberry32): el sorteo del test es reproducible. */
function seeded(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function run(format: 'F8' | 'F11', pick: (state: QuizState) => string, seed = 1) {
  const random = seeded(seed);
  let state = startQuiz(QUESTIONNAIRE, { id: uuid(9), format }, random, {
    clientAttemptId: uuid(7),
    now: new Date('2026-10-21T10:00:00Z'),
  });
  while (state.phase !== 'done') state = answer(state, pick(state), QUESTIONNAIRE, random);
  return state;
}

/** Elige la opción que da puntos a `pos` (en el orden barajado que se mostró). */
const choose = (pos: string) => (state: QuizState) => {
  const item =
    state.phase === 'position' ? state.positionItems[state.index]! : state.prepItems[state.index]!;
  if (state.phase === 'prep') return item.options[0]!.id;
  const source = QUESTIONNAIRE.positionItems.find((q) => q.id === item.id)!;
  return source.options.find((o) => (o.points as Record<string, number>)[pos])!.id;
};

describe('motor del test', () => {
  it('sortea 15 ítems distintos y baraja las opciones', () => {
    const state = startQuiz(QUESTIONNAIRE, { id: uuid(9), format: 'F11' }, seeded(3), {
      clientAttemptId: uuid(7),
      now: new Date(),
    });
    expect(new Set(state.positionItems.map((i) => i.id)).size).toBe(15);
    const shuffled = state.positionItems.some((item) => {
      const original = QUESTIONNAIRE.positionItems.find((q) => q.id === item.id)!;
      return item.options.map((o) => o.id).join() !== original.options.map((o) => o.id).join();
    });
    expect(shuffled).toBe(true);
  });

  it('tras las 15 de posición sirve las 8 de preparación de la ganadora', () => {
    const state = run('F11', choose('MP'));
    expect(state.winner).toBe('MP');
    expect(state.prepItems).toHaveLength(8);
    expect(state.prepItems.every((i) => i.text.startsWith('MP '))).toBe(true);
  });

  it('en F8 la mediapunta se pliega en delantero: la preparación es la de DC', () => {
    const state = run('F8', choose('MP'));
    expect(state.winner).toBe('DC');
    expect(state.prepItems.every((i) => i.text.startsWith('DC '))).toBe(true);
  });

  it('arma un envío válido para el contrato, con el orden mostrado de las opciones', () => {
    const state = run('F11', choose('EXT'));
    const submission = SubmitAttemptRequestSchema.parse(
      toSubmission(state, new Date('2026-10-21T10:06:00Z')),
    );
    expect(submission.positionItems).toHaveLength(15);
    expect(submission.prepItems).toHaveLength(8);
    expect(submission.positionItems[0]!.optionOrder).toEqual(
      state.positionItems[0]!.options.map((o) => o.id),
    );
    expect(submission.clientResult).toEqual({ winner: 'EXT' });
  });
});
