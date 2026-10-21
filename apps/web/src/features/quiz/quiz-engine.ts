import type { MatchFormat, QuestionnaireResponse, SubmitAttemptRequest } from '@sdl/contracts';
import { scorePosition, type PositionCode } from '@sdl/domain';

/**
 * El test en el celular (docs/02 §3), sin React ni red: sortea las preguntas, baraja las
 * opciones, calcula un podio provisional (para verlo sin señal) y arma el envío. El
 * resultado oficial lo calcula el servidor.
 */

export type Random = () => number;

export interface ShownItem {
  id: string;
  text: string;
  context: 'situation' | 'attribute';
  /** En el orden en que se muestran. */
  options: { id: string; label: string }[];
}

export interface QuizState {
  clientAttemptId: string;
  teamId: string;
  format: MatchFormat;
  versionId: string;
  startedAt: string;
  /** Pregunta actual. */
  index: number;
  items: ShownItem[];
  answers: string[];
  /** Al terminar: el podio calculado en el celular, provisional hasta el oficial. */
  provisionalPodium: PositionCode[] | null;
}

export const isDone = (state: QuizState) => state.provisionalPodium !== null;

/** Fisher–Yates con el azar inyectado (en la app, crypto; en los tests, con semilla). */
export function shuffle<T>(items: readonly T[], random: Random): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [out[i], out[j]] = [out[j]!, out[i]!];
  }
  return out;
}

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
    index: 0,
    items: items.map((item) => ({
      id: item.id,
      text: item.text,
      context: item.context,
      options: shuffle(item.options, random).map(({ id, label }) => ({ id, label })),
    })),
    answers: [],
    provisionalPodium: null,
  };
}

/** Responde la pregunta actual y avanza; con la última, calcula el podio provisional. */
export function answer(
  state: QuizState,
  optionId: string,
  questionnaire: QuestionnaireResponse,
): QuizState {
  if (isDone(state)) return state;
  const answers = [...state.answers, optionId];
  if (answers.length < state.items.length) return { ...state, answers, index: state.index + 1 };

  const byId = new Map(questionnaire.positionItems.map((item) => [item.id, item]));
  const ranking = scorePosition(
    state.items.map((item) => ({ id: item.id, options: byId.get(item.id)!.options })),
    answers,
    state.format,
  );
  return { ...state, answers, provisionalPodium: ranking.slice(0, 3).map((entry) => entry.pos) };
}

/** El envío de 05 · POST /attempts con lo que se mostró y lo que eligió. */
export function toSubmission(state: QuizState, now: Date): SubmitAttemptRequest {
  if (!isDone(state)) throw new Error('El test no ha terminado');
  return {
    clientAttemptId: state.clientAttemptId,
    teamId: state.teamId,
    questionnaireVersionId: state.versionId,
    format: state.format,
    startedAt: state.startedAt,
    submittedAt: now.toISOString(),
    positionItems: state.items.map((item, i) => ({
      itemId: item.id,
      shownOrder: i + 1,
      optionOrder: item.options.map((o) => o.id),
      answerOptionId: state.answers[i]!,
    })),
  };
}
