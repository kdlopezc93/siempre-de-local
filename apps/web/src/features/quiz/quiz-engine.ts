import type { MatchFormat, QuestionnaireResponse, SubmitAttemptRequest } from '@sdl/contracts';
import { scorePosition, type PositionCode } from '@sdl/domain';

/**
 * El test en el celular (docs/02 §3), sin React ni red: sortea, baraja, calcula el ganador
 * para servir su preparación y arma el envío. El servidor vuelve a calcular todo.
 */

export type Random = () => number;

export interface ShownItem {
  id: string;
  text: string;
  context?: 'situation' | 'attribute';
  /** En el orden en que se muestran. */
  options: { id: string; label: string }[];
}

export interface QuizState {
  clientAttemptId: string;
  teamId: string;
  format: MatchFormat;
  versionId: string;
  startedAt: string;
  phase: 'position' | 'prep' | 'done';
  /** Pregunta actual dentro de la fase. */
  index: number;
  positionItems: ShownItem[];
  positionAnswers: string[];
  winner: PositionCode | null;
  prepItems: ShownItem[];
  prepAnswers: string[];
}

/** Fisher–Yates con el azar inyectado (en la app, crypto; en los tests, con semilla). */
export function shuffle<T>(items: readonly T[], random: Random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

const showOptions = (options: { id: string; label: string }[], random: Random) =>
  shuffle(options, random).map(({ id, label }) => ({ id, label }));

export function startQuiz(
  questionnaire: QuestionnaireResponse,
  team: { id: string; format: MatchFormat },
  random: Random,
  { clientAttemptId, now }: { clientAttemptId: string; now: Date },
): QuizState {
  const items = shuffle(questionnaire.positionItems, random).slice(
    0,
    questionnaire.positionItemsPerAttempt,
  );
  return {
    clientAttemptId,
    teamId: team.id,
    format: team.format,
    versionId: questionnaire.versionId,
    startedAt: now.toISOString(),
    phase: 'position',
    index: 0,
    positionItems: items.map((item) => ({
      id: item.id,
      text: item.text,
      context: item.context,
      options: showOptions(item.options, random),
    })),
    positionAnswers: [],
    winner: null,
    prepItems: [],
    prepAnswers: [],
  };
}

/** Responde la pregunta actual y avanza; al cerrar la fase de posición sirve la preparación. */
export function answer(
  state: QuizState,
  optionId: string,
  questionnaire: QuestionnaireResponse,
  random: Random,
): QuizState {
  if (state.phase === 'position') {
    const positionAnswers = [...state.positionAnswers, optionId];
    if (positionAnswers.length < state.positionItems.length) {
      return { ...state, positionAnswers, index: state.index + 1 };
    }
    const winner = winnerOf(state.positionItems, positionAnswers, questionnaire, state.format);
    // En preparación salen las 8 de la ganadora; solo se baraja el orden (traspaso §3).
    const prep = questionnaire.prepItems.filter((item) => item.position === winner);
    return {
      ...state,
      positionAnswers,
      winner,
      phase: 'prep',
      index: 0,
      prepItems: shuffle(prep, random).map((item) => ({
        id: item.id,
        text: item.text,
        options: showOptions(item.options, random),
      })),
    };
  }
  if (state.phase === 'prep') {
    const prepAnswers = [...state.prepAnswers, optionId];
    const done = prepAnswers.length === state.prepItems.length;
    return {
      ...state,
      prepAnswers,
      phase: done ? 'done' : 'prep',
      index: done ? state.index : state.index + 1,
    };
  }
  return state;
}

function winnerOf(
  shown: ShownItem[],
  answers: string[],
  questionnaire: QuestionnaireResponse,
  format: MatchFormat,
): PositionCode {
  const byId = new Map(questionnaire.positionItems.map((item) => [item.id, item]));
  const served = shown.map((item) => ({ id: item.id, options: byId.get(item.id)!.options }));
  return scorePosition(served, answers, format)[0]!.pos;
}

/** El envío de 05 · POST /attempts con lo que se mostró y lo que eligió. */
export function toSubmission(state: QuizState, now: Date): SubmitAttemptRequest {
  if (state.phase !== 'done' || !state.winner) throw new Error('El test no ha terminado');
  const served = (items: ShownItem[], answers: string[]) =>
    items.map((item, i) => ({
      itemId: item.id,
      shownOrder: i + 1,
      optionOrder: item.options.map((o) => o.id),
      answerOptionId: answers[i]!,
    }));
  return {
    clientAttemptId: state.clientAttemptId,
    teamId: state.teamId,
    questionnaireVersionId: state.versionId,
    format: state.format,
    startedAt: state.startedAt,
    submittedAt: now.toISOString(),
    positionItems: served(state.positionItems, state.positionAnswers),
    prepItems: served(state.prepItems, state.prepAnswers),
    clientResult: { winner: state.winner },
  };
}
