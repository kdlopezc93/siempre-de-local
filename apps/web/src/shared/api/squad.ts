import {
  AssessmentResponseSchema,
  SquadResponseSchema,
  type Assessment,
  type CreateAssessmentRequest,
  type SquadResponse,
} from '@sdl/contracts';

import { apiRequest } from './http';

export function fetchSquad(teamId: string): Promise<SquadResponse> {
  return apiRequest(`/api/v1/teams/${teamId}/squad`, SquadResponseSchema);
}

export async function createAssessment(
  teamId: string,
  request: CreateAssessmentRequest,
): Promise<Assessment> {
  const { assessment } = await apiRequest(
    `/api/v1/teams/${teamId}/assessments`,
    AssessmentResponseSchema,
    { method: 'POST', body: JSON.stringify(request) },
  );
  return assessment;
}
