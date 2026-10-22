import { LineupInputsResponseSchema, type LineupInputsResponse } from '@sdl/contracts';

import { apiRequest } from './http';

/** Lo que necesita el celular para armar la alineación (02 §9). */
export function fetchLineupInputs(teamId: string): Promise<LineupInputsResponse> {
  return apiRequest(`/api/v1/teams/${teamId}/lineup-inputs`, LineupInputsResponseSchema);
}
