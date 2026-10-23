import {
  MatchListResponseSchema,
  MatchResponseSchema,
  PublishedLineupResponseSchema,
  type CreateMatchRequest,
  type MatchListResponse,
  type MatchReply,
  type MatchResponse,
  type PublishedLineupResponse,
  type UpdateMatchRequest,
} from '@sdl/contracts';

import { apiRequest } from './http';

const base = (teamId: string) => `/api/v1/teams/${teamId}/matches`;

export function fetchMatches(teamId: string): Promise<MatchListResponse> {
  return apiRequest(base(teamId), MatchListResponseSchema);
}

export function fetchMatch(teamId: string, matchId: string): Promise<MatchResponse> {
  return apiRequest(`${base(teamId)}/${matchId}`, MatchResponseSchema);
}

export function createMatch(teamId: string, request: CreateMatchRequest): Promise<MatchResponse> {
  return apiRequest(base(teamId), MatchResponseSchema, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function updateMatch(
  teamId: string,
  matchId: string,
  patch: UpdateMatchRequest,
): Promise<MatchResponse> {
  return apiRequest(`${base(teamId)}/${matchId}`, MatchResponseSchema, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

export function replyMatch(
  teamId: string,
  matchId: string,
  reply: MatchReply,
): Promise<MatchResponse> {
  return apiRequest(`${base(teamId)}/${matchId}/reply`, MatchResponseSchema, {
    method: 'PUT',
    body: JSON.stringify({ reply }),
  });
}

export function fetchPublishedLineup(
  teamId: string,
  matchId: string,
): Promise<PublishedLineupResponse> {
  return apiRequest(`${base(teamId)}/${matchId}/lineup`, PublishedLineupResponseSchema);
}
