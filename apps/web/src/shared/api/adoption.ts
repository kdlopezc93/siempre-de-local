import { type AdoptionResponse, AdoptionResponseSchema } from '@sdl/contracts';

import { apiRequest } from './http';

/** La app en el equipo (cuerpo técnico, 2026-11-06). */
export function fetchAdoption(teamId: string): Promise<AdoptionResponse> {
  return apiRequest(`/api/v1/teams/${teamId}/adoption`, AdoptionResponseSchema);
}
