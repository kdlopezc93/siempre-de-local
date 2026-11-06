import { useQuery } from '@tanstack/react-query';

import { fetchAdoption } from '../../shared/api/adoption';

export const adoptionKey = (teamId: string) => ['team', teamId, 'adoption'] as const;

export function useAdoption(teamId: string, enabled = true) {
  return useQuery({
    queryKey: adoptionKey(teamId),
    queryFn: () => fetchAdoption(teamId),
    enabled,
  });
}
