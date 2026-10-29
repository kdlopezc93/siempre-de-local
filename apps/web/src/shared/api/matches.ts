import {
  MatchListResponseSchema,
  MatchRatingsResponseSchema,
  MatchResponseSchema,
  PlayerMatchRatingsResponseSchema,
  PublishedLineupResponseSchema,
  TournamentListResponseSchema,
  TournamentResponseSchema,
  type CreateMatchRequest,
  type MatchListResponse,
  type MatchRatingRequest,
  type MatchRatingsResponse,
  type MatchReply,
  type MatchResponse,
  type MatchResultRequest,
  type PlayerMatchRatingsResponse,
  type PublishedLineupResponse,
  type TournamentListResponse,
  type TournamentResponse,
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

/** Después del partido (D18): el resultado y la figura (cuerpo técnico). */
export function recordMatchResult(
  teamId: string,
  matchId: string,
  request: MatchResultRequest,
): Promise<MatchResponse> {
  return apiRequest(`${base(teamId)}/${matchId}/result`, MatchResponseSchema, {
    method: 'PUT',
    body: JSON.stringify(request),
  });
}

export function fetchMatchRatings(teamId: string, matchId: string): Promise<MatchRatingsResponse> {
  return apiRequest(`${base(teamId)}/${matchId}/ratings`, MatchRatingsResponseSchema);
}

export function rateMatchPlayer(
  teamId: string,
  matchId: string,
  playerId: string,
  request: MatchRatingRequest,
): Promise<MatchRatingsResponse> {
  return apiRequest(`${base(teamId)}/${matchId}/ratings/${playerId}`, MatchRatingsResponseSchema, {
    method: 'PUT',
    body: JSON.stringify(request),
  });
}

export function unrateMatchPlayer(
  teamId: string,
  matchId: string,
  playerId: string,
): Promise<MatchRatingsResponse> {
  return apiRequest(`${base(teamId)}/${matchId}/ratings/${playerId}`, MatchRatingsResponseSchema, {
    method: 'DELETE',
  });
}

/** Partido a partido de un jugador (ficha, cuerpo técnico). */
export function fetchPlayerMatchRatings(
  teamId: string,
  playerId: string,
): Promise<PlayerMatchRatingsResponse> {
  return apiRequest(
    `/api/v1/teams/${teamId}/players/${playerId}/match-ratings`,
    PlayerMatchRatingsResponseSchema,
  );
}

/** Los torneos del equipo (2026-10-28): los partidos de campeonato son de uno. */
export function fetchTournaments(teamId: string): Promise<TournamentListResponse> {
  return apiRequest(`/api/v1/teams/${teamId}/tournaments`, TournamentListResponseSchema);
}

export function createTournament(teamId: string, name: string): Promise<TournamentResponse> {
  return apiRequest(`/api/v1/teams/${teamId}/tournaments`, TournamentResponseSchema, {
    method: 'POST',
    body: JSON.stringify({ name }),
  });
}
