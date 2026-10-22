import { ValidationResponseSchema, type ValidationResponse } from '@sdl/contracts';

import { apiRequest } from './http';

export function fetchValidation(teamId: string): Promise<ValidationResponse> {
  return apiRequest(`/api/v1/teams/${teamId}/validation`, ValidationResponseSchema);
}
