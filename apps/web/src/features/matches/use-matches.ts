import type { CreateMatchRequest, MatchReply, UpdateMatchRequest } from '@sdl/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createMatch,
  fetchMatch,
  fetchMatches,
  fetchPublishedLineup,
  replyMatch,
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
