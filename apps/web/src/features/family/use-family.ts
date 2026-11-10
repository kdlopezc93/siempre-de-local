import type { MatchListResponse, MatchReply } from '@sdl/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchChildMatches, replyForChild } from '../../shared/api/family';

/** Todo lo del niño en caché (lo invalida el service worker al responder por él). */
export const childKey = (minorId: string) => ['child', minorId] as const;
const matchesKey = (minorId: string, teamId: string) =>
  [...childKey(minorId), 'team', teamId, 'matches'] as const;

/** Los partidos del grupo del niño, como los ve él (sin quién respondió qué). */
export function useChildMatches(minorId: string, teamId: string) {
  return useQuery({
    queryKey: matchesKey(minorId, teamId),
    queryFn: () => fetchChildMatches(minorId, teamId),
    networkMode: 'offlineFirst',
  });
}

/** Va / No va por el niño: la respuesta trae el partido al día y se pone en la lista. */
export function useReplyForChild(minorId: string, teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ matchId, reply }: { matchId: string; reply: MatchReply }) =>
      replyForChild(minorId, teamId, matchId, reply),
    onSuccess: ({ match }) => {
      queryClient.setQueryData<MatchListResponse>(matchesKey(minorId, teamId), (old) =>
        old ? { items: old.items.map((m) => (m.id === match.id ? match : m)) } : old,
      );
    },
  });
}
