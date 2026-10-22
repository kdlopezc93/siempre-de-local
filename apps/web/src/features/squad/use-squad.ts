import type { CreateAssessmentRequest } from '@sdl/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createAssessment, fetchSquad } from '../../shared/api/squad';

const squadKey = (teamId: string) => ['team', teamId, 'squad'] as const;

export function useSquad(teamId: string) {
  return useQuery({ queryKey: squadKey(teamId), queryFn: () => fetchSquad(teamId) });
}

/** Al valorar se refresca la plantilla: puede destapar el test de ese jugador. */
export function useCreateAssessment(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateAssessmentRequest) => createAssessment(teamId, request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: squadKey(teamId) }),
  });
}
