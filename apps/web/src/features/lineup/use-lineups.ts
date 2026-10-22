import type { LineupInput } from '@sdl/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { deleteLineup, fetchLineup, fetchLineups, saveLineup } from '../../shared/api/lineups';

const listKey = (teamId: string) => ['team', teamId, 'lineups'] as const;

export function useLineups(teamId: string) {
  return useQuery({ queryKey: listKey(teamId), queryFn: () => fetchLineups(teamId) });
}

export function useLineup(teamId: string, lineupId: string | null) {
  return useQuery({
    queryKey: [...listKey(teamId), lineupId],
    queryFn: () => fetchLineup(teamId, lineupId!),
    enabled: lineupId !== null,
  });
}

export function useSaveLineup(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ input, lineupId }: { input: LineupInput; lineupId?: string }) =>
      saveLineup(teamId, input, lineupId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listKey(teamId) }),
  });
}

export function useDeleteLineup(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (lineupId: string) => deleteLineup(teamId, lineupId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: listKey(teamId) }),
  });
}
