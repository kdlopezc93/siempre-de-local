import {
  MyCardResponseSchema,
  RatingAttributesResponseSchema,
  RatingHistoryResponseSchema,
  RatingResponseSchema,
  TeamResponseSchema,
  type CreateRatingRequest,
  type MyCardResponse,
  type PlayerRating,
  type RatingAttributesResponse,
  type TeamResponse,
  type UpdateTeamRequest,
} from '@sdl/contracts';

import { apiRequest } from './http';

export function fetchRatingCatalog(): Promise<RatingAttributesResponse> {
  return apiRequest('/api/v1/rating-attributes', RatingAttributesResponseSchema);
}

export async function fetchRatingHistory(
  teamId: string,
  playerId: string,
): Promise<PlayerRating[]> {
  const { items } = await apiRequest(
    `/api/v1/teams/${teamId}/players/${playerId}/ratings`,
    RatingHistoryResponseSchema,
  );
  return items;
}

export async function createRating(
  teamId: string,
  playerId: string,
  request: CreateRatingRequest,
): Promise<PlayerRating> {
  const { rating } = await apiRequest(
    `/api/v1/teams/${teamId}/players/${playerId}/ratings`,
    RatingResponseSchema,
    { method: 'POST', body: JSON.stringify(request) },
  );
  return rating;
}

export function fetchMyCard(teamId: string): Promise<MyCardResponse> {
  return apiRequest(`/api/v1/me/card?teamId=${encodeURIComponent(teamId)}`, MyCardResponseSchema);
}

export function updateTeam(teamId: string, patch: UpdateTeamRequest): Promise<TeamResponse> {
  return apiRequest(`/api/v1/teams/${teamId}`, TeamResponseSchema, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}
