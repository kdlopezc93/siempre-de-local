import {
  LineupInputsResponseSchema,
  LineupListResponseSchema,
  LineupResponseSchema,
  type Lineup,
  type LineupInput,
  type LineupInputsResponse,
  type LineupListResponse,
} from '@sdl/contracts';

import { apiFetch, apiRequest } from './http';

/** Lo que necesita el celular para armar la alineación (02 §9). */
export function fetchLineupInputs(teamId: string): Promise<LineupInputsResponse> {
  return apiRequest(`/api/v1/teams/${teamId}/lineup-inputs`, LineupInputsResponseSchema);
}

export function fetchLineups(teamId: string): Promise<LineupListResponse> {
  return apiRequest(`/api/v1/teams/${teamId}/lineups`, LineupListResponseSchema);
}

export async function fetchLineup(teamId: string, lineupId: string): Promise<Lineup> {
  const { lineup } = await apiRequest(
    `/api/v1/teams/${teamId}/lineups/${lineupId}`,
    LineupResponseSchema,
  );
  return lineup;
}

/** Sin `lineupId` la crea; con él, la reemplaza. */
export async function saveLineup(
  teamId: string,
  input: LineupInput,
  lineupId?: string,
): Promise<Lineup> {
  const { lineup } = await apiRequest(
    `/api/v1/teams/${teamId}/lineups${lineupId ? `/${lineupId}` : ''}`,
    LineupResponseSchema,
    { method: lineupId ? 'PUT' : 'POST', body: JSON.stringify(input) },
  );
  return lineup;
}

export async function deleteLineup(teamId: string, lineupId: string) {
  await apiFetch(`/api/v1/teams/${teamId}/lineups/${lineupId}`, { method: 'DELETE' });
}

/** Publica (o republica) la alineación de su partido para todo el equipo (D17). */
export async function publishLineup(teamId: string, lineupId: string) {
  await apiFetch(`/api/v1/teams/${teamId}/lineups/${lineupId}/publish`, { method: 'POST' });
}
