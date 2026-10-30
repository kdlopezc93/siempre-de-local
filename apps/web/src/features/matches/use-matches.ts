import type {
  CreateMatchRequest,
  MatchRatingRequest,
  MatchReply,
  MatchResultRequest,
  UpdateMatchRequest,
} from '@sdl/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createMatch,
  createTournament,
  fetchTournaments,
  fetchMatch,
  fetchMatchRatings,
  fetchMatches,
  fetchPlayerMatchRatings,
  fetchPublishedLineup,
  rateMatchPlayer,
  recordMatchResult,
  replyMatch,
  takeMatchAttendance,
  unrateMatchPlayer,
  updateMatch,
} from '../../shared/api/matches';

export const matchesKey = (teamId: string) => ['team', teamId, 'matches'] as const;

export function useMatches(teamId: string, enabled = true) {
  return useQuery({
    queryKey: matchesKey(teamId),
    queryFn: () => fetchMatches(teamId),
    enabled,
    networkMode: 'offlineFirst',
  });
}

export function useMatch(teamId: string, matchId: string | null) {
  return useQuery({
    queryKey: [...matchesKey(teamId), matchId],
    queryFn: () => fetchMatch(teamId, matchId!),
    enabled: matchId !== null,
    networkMode: 'offlineFirst',
  });
}

/** Tras convocar, editar o responder: el partido nuevo en caché y la lista al día. */
function useMatchMutation<V>(teamId: string, fn: (vars: V) => ReturnType<typeof fetchMatch>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      queryClient.setQueryData([...matchesKey(teamId), data.match.id], data);
      void queryClient.invalidateQueries({ queryKey: matchesKey(teamId), exact: true });
    },
  });
}

export const useCreateMatch = (teamId: string) =>
  useMatchMutation(teamId, (request: CreateMatchRequest) => createMatch(teamId, request));

export const useUpdateMatch = (teamId: string, matchId: string) =>
  useMatchMutation(teamId, (patch: UpdateMatchRequest) => updateMatch(teamId, matchId, patch));

export const useReplyMatch = (teamId: string, matchId: string) =>
  useMatchMutation(teamId, (reply: MatchReply) => replyMatch(teamId, matchId, reply));

/** La alineación publicada (todo el equipo); solo se pide si el partido tiene una. */
export function usePublishedLineup(teamId: string, matchId: string, publishedAt: string | null) {
  return useQuery({
    queryKey: [...matchesKey(teamId), matchId, 'lineup', publishedAt],
    queryFn: () => fetchPublishedLineup(teamId, matchId),
    enabled: publishedAt !== null,
    networkMode: 'offlineFirst',
  });
}

export const useRecordMatchResult = (teamId: string, matchId: string) =>
  useMatchMutation(teamId, (request: MatchResultRequest) =>
    recordMatchResult(teamId, matchId, request),
  );

export const useTakeAttendance = (teamId: string, matchId: string) =>
  useMatchMutation(teamId, (playerIds: string[]) =>
    takeMatchAttendance(teamId, matchId, playerIds),
  );

const playerRatingsKey = (teamId: string, playerId: string) =>
  ['team', teamId, 'players', playerId, 'match-ratings'] as const;

const ratingsKey = (teamId: string, matchId: string) =>
  [...matchesKey(teamId), matchId, 'ratings'] as const;

/** Las evaluaciones del partido, con notas (cuerpo técnico). */
export function useMatchRatings(teamId: string, matchId: string, enabled = true) {
  return useQuery({
    queryKey: ratingsKey(teamId, matchId),
    queryFn: () => fetchMatchRatings(teamId, matchId),
    enabled,
    networkMode: 'offlineFirst',
  });
}

/**
 * Evaluar o quitar la evaluación de un jugador. Cada fila tiene la suya, así una no pisa el
 * estado de otra; la respuesta trae la lista completa y la deja en caché.
 */
export function useRateMatchPlayer(teamId: string, matchId: string, playerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: MatchRatingRequest | null) =>
      request
        ? rateMatchPlayer(teamId, matchId, playerId, request)
        : unrateMatchPlayer(teamId, matchId, playerId),
    onSuccess: (data) => {
      queryClient.setQueryData(ratingsKey(teamId, matchId), data);
      void queryClient.invalidateQueries({ queryKey: playerRatingsKey(teamId, playerId) });
    },
  });
}

/** Partido a partido de un jugador (ficha, cuerpo técnico). */
export function usePlayerMatchRatings(teamId: string, playerId: string, enabled = true) {
  return useQuery({
    queryKey: playerRatingsKey(teamId, playerId),
    queryFn: () => fetchPlayerMatchRatings(teamId, playerId),
    enabled,
    networkMode: 'offlineFirst',
  });
}

const tournamentsKey = (teamId: string) => ['team', teamId, 'tournaments'] as const;

/** Los torneos del equipo, para elegir uno al convocar de campeonato. */
export function useTournaments(teamId: string, enabled = true) {
  return useQuery({
    queryKey: tournamentsKey(teamId),
    queryFn: () => fetchTournaments(teamId),
    enabled,
    networkMode: 'offlineFirst',
  });
}

export function useCreateTournament(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (name: string) => createTournament(teamId, name),
    onSuccess: () => void queryClient.invalidateQueries({ queryKey: tournamentsKey(teamId) }),
  });
}
