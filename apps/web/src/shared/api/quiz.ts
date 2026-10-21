import {
  AttemptResultSchema,
  QuestionnaireResponseSchema,
  type AttemptResult,
  type QuestionnaireResponse,
  type SubmitAttemptRequest,
} from '@sdl/contracts';

import { apiRequest } from './http';

/** Lo cachea el service worker (vite.config.ts): se puede responder sin conexión. */
export function fetchQuestionnaire(): Promise<QuestionnaireResponse> {
  return apiRequest('/api/v1/questionnaires/current', QuestionnaireResponseSchema);
}

export function submitAttempt(attempt: SubmitAttemptRequest): Promise<AttemptResult> {
  return apiRequest('/api/v1/attempts', AttemptResultSchema, {
    method: 'POST',
    body: JSON.stringify(attempt),
  });
}
