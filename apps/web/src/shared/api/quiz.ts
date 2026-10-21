import {
  AttemptListResponseSchema,
  AttemptResultSchema,
  QuestionnaireResponseSchema,
  type AttemptListResponse,
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

export function fetchAttempt(attemptId: string): Promise<AttemptResult> {
  return apiRequest(`/api/v1/attempts/${attemptId}`, AttemptResultSchema);
}

export function fetchMyAttempts(): Promise<AttemptListResponse> {
  return apiRequest('/api/v1/me/attempts', AttemptListResponseSchema);
}
