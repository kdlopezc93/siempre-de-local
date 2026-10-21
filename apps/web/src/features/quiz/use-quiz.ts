import type { AttemptResult, MatchFormat, SubmitAttemptRequest } from '@sdl/contracts';
import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';

import { fetchQuestionnaire, submitAttempt } from '../../shared/api/quiz';
import { enqueue, requestPersistentStorage, type OutboxSender } from '../../shared/offline/outbox';
import { useOutbox, useOutboxSync } from '../../shared/offline/use-outbox';
import { answer, startQuiz, toSubmission, type QuizState } from './quiz-engine';

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

export type SubmitStatus =
  | { kind: 'sending' }
  | { kind: 'saved-offline' }
  | { kind: 'needs-auth' }
  | { kind: 'rejected'; reason: string }
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
    const next = answer(state, optionId, questionnaire.data, cryptoRandom);
    setState(next);
    if (next.phase === 'done') {
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

  // El estado del envío sale de la cola (sobrevive a cerrar la app).
  const item = state && outbox.items.find((i) => i.id === state.clientAttemptId);
  let submit: SubmitStatus | null = null;
  if (state?.phase === 'done') {
    if (item?.status === 'sent') submit = { kind: 'scored', result: item.result as AttemptResult };
    else if (item?.status === 'rejected')
      submit = { kind: 'rejected', reason: item.lastError ?? '' };
    else if (outbox.lastOutcome === 'needs-auth') submit = { kind: 'needs-auth' };
    else if (item && item.tries > 0) submit = { kind: 'saved-offline' };
    else submit = { kind: 'sending' };
  }

  return { questionnaire, state, start, choose, submit, restart: () => setState(null) };
}
