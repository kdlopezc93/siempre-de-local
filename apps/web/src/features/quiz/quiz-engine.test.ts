import { SubmitAttemptRequestSchema } from '@sdl/contracts';
import { describe, expect, it } from 'vitest';

import { QUESTIONNAIRE, uuid } from '../../test/questionnaire-fixture';
import { answer, isDone, startQuiz, toSubmission, type QuizState } from './quiz-engine';

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
  let state = startQuiz(QUESTIONNAIRE, { id: uuid(9), format }, seeded(seed), {
    clientAttemptId: uuid(7),
    now: new Date('2026-10-21T10:00:00Z'),
  });
  while (!isDone(state)) state = answer(state, pick(state), QUESTIONNAIRE);
  return state;
}

/** Elige, en cada pregunta, la opción que da puntos a `pos` (esté donde esté al barajar). */
const choose = (pos: string) => (state: QuizState) => {
  const source = QUESTIONNAIRE.positionItems.find((q) => q.id === state.items[state.index]!.id)!;
  return source.options.find((o) => (o.points as Record<string, number>)[pos])!.id;
};

describe('motor del test', () => {
  it('sortea 20 preguntas distintas y baraja las opciones', () => {
    const state = startQuiz(QUESTIONNAIRE, { id: uuid(9), format: 'F11' }, seeded(3), {
      clientAttemptId: uuid(7),
      now: new Date(),
    });
    expect(new Set(state.items.map((i) => i.id)).size).toBe(20);
    const shuffled = state.items.some((item) => {
      const original = QUESTIONNAIRE.positionItems.find((q) => q.id === item.id)!;
      return item.options.map((o) => o.id).join() !== original.options.map((o) => o.id).join();
    });
    expect(shuffled).toBe(true);
  });

  it('al terminar calcula el podio provisional', () => {
    const state = run('F11', choose('MP'));
    expect(state.answers).toHaveLength(20);
    expect(state.provisionalPodium?.[0]).toBe('MP');
    expect(state.provisionalPodium).toHaveLength(3);
  });

  it('en F8 la mediapunta se pliega en delantero', () => {
    expect(run('F8', choose('MP')).provisionalPodium?.[0]).toBe('DC');
  });

  it('arma un envío válido para el contrato, con el orden mostrado de las opciones', () => {
    const state = run('F11', choose('EXT'));
    const submission = SubmitAttemptRequestSchema.parse(
      toSubmission(state, new Date('2026-10-21T10:06:00Z')),
    );
    expect(submission.positionItems).toHaveLength(20);
    expect(submission.positionItems[0]!.optionOrder).toEqual(
      state.items[0]!.options.map((o) => o.id),
    );
  });
});
