import type {
  AttemptResult,
  MatchFormat,
  PositionCode,
  SubmitAttemptRequest,
} from '@sdl/contracts';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { fetchQuestionnaire, submitAttempt } from '../../shared/api/quiz';
import { enqueue, requestPersistentStorage, type OutboxSender } from '../../shared/offline/outbox';
import { useOutbox, useOutboxSync } from '../../shared/offline/use-outbox';
import { answer, isDone, startQuiz, toSubmission, type QuizState } from './quiz-engine';

const KIND = 'orientation-attempt';
const SENDERS: Record<string, OutboxSender> = {
  [KIND]: (payload) => submitAttempt(payload as SubmitAttemptRequest),
};

/** Azar del navegador para sortear preguntas y barajar opciones. */
const cryptoRandom = () => crypto.getRandomValues(new Uint32Array(1))[0]! / 2 ** 32;

export function useQuestionnaire() {
  return useQuery({
    queryKey: ['questionnaire', 'current'],
    queryFn: fetchQuestionnaire,
    // Sin red, el service worker responde con la copia guardada (ADR-06).
    networkMode: 'offlineFirst',
    staleTime: 60 * 60_000,
  });
}

/** Mientras no llega el oficial se muestra el podio calculado en el celular. */
export type SubmitStatus =
  | { kind: 'sending'; provisionalPodium: { pos: PositionCode; pct: number }[] }
  | { kind: 'saved-offline'; provisionalPodium: { pos: PositionCode; pct: number }[] }
  | { kind: 'needs-auth'; provisionalPodium: { pos: PositionCode; pct: number }[] }
  | { kind: 'rejected' }
  | { kind: 'scored'; result: AttemptResult };

/**
 * El test en curso. Al terminar, el envío pasa siempre por la cola: con red sale al
 * instante; sin red queda en el celular y sale solo cuando vuelve la conexión.
 */
export function useQuiz(userId: string, team: { id: string; format: MatchFormat }) {
  const questionnaire = useQuestionnaire();
  const [state, setState] = useState<QuizState | null>(null);
  const flush = useOutboxSync(userId, SENDERS);
  const outbox = useOutbox();

  function start() {
    if (!questionnaire.data) return;
    setState(
      startQuiz(questionnaire.data, team, cryptoRandom, {
        clientAttemptId: crypto.randomUUID(),
        now: new Date(),
      }),
    );
  }

  async function choose(optionId: string) {
    if (!state || !questionnaire.data) return;
    const next = answer(state, optionId, questionnaire.data);
    setState(next);
    if (isDone(next)) {
      await enqueue({
        id: next.clientAttemptId,
        kind: KIND,
        userId,
        payload: toSubmission(next, new Date()),
      });
      void requestPersistentStorage();
      await flush();
    }
  }

  return {
    questionnaire,
    state,
    start,
    choose,
    submit: submitStatus(state, outbox),
    restart: () => setState(null),
  };
}

/** El estado del envío sale de la cola (sobrevive a cerrar la app). */
function submitStatus(
  state: QuizState | null,
  outbox: ReturnType<typeof useOutbox>,
): SubmitStatus | null {
  if (!state || !isDone(state)) return null;
  const provisionalPodium = state.provisionalPodium!;
  const item = outbox.items.find((i) => i.id === state.clientAttemptId);
  if (item?.status === 'sent') return { kind: 'scored', result: item.result as AttemptResult };
  if (item?.status === 'rejected') return { kind: 'rejected' };
  if (outbox.lastOutcome === 'needs-auth') return { kind: 'needs-auth', provisionalPodium };
  if (item && item.tries > 0) return { kind: 'saved-offline', provisionalPodium };
  return { kind: 'sending', provisionalPodium };
}
