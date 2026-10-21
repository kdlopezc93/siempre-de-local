import {
  SpikeAttemptResponseSchema,
  SpikeQuestionnaireSchema,
  type SpikeAttemptRequest,
  type SpikeAttemptResponse,
  type SpikeQuestionnaire,
} from '@sdl/contracts';

import { apiRequest } from './http';

/** TEMPORAL · spike PWA (docs/spikes/pwa.md). */

export const SPIKE_QUESTIONNAIRE_PATH = '/api/v1/spike/questionnaire';

export function fetchSpikeQuestionnaire(): Promise<SpikeQuestionnaire> {
  return apiRequest(SPIKE_QUESTIONNAIRE_PATH, SpikeQuestionnaireSchema);
}

export function submitSpikeAttempt(attempt: SpikeAttemptRequest): Promise<SpikeAttemptResponse> {
  return apiRequest('/api/v1/spike/attempts', SpikeAttemptResponseSchema, {
    method: 'POST',
    body: JSON.stringify(attempt),
  });
}
