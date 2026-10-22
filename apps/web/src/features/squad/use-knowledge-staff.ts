import type { CreateKnowledgeReviewRequest, VoidExamRequest } from '@sdl/contracts';
import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  cancelKnowledgeReview,
  requestKnowledgeReview,
  voidExam,
} from '../../shared/api/certification';

/** Lo que cambia el conocimiento de un jugador se ve en el perfil y en la plantilla. */
function useTeamRefresh(teamId: string) {
  const queryClient = useQueryClient();
  return () => queryClient.invalidateQueries({ queryKey: ['team', teamId] });
}

export function useVoidExam(teamId: string) {
  const refresh = useTeamRefresh(teamId);
  return useMutation({
    mutationFn: ({ examId, ...request }: VoidExamRequest & { examId: string }) =>
      voidExam(teamId, examId, request),
    onSuccess: refresh,
  });
}

export function useRequestReview(teamId: string, playerId: string) {
  const refresh = useTeamRefresh(teamId);
  return useMutation({
    mutationFn: (request: CreateKnowledgeReviewRequest) =>
      requestKnowledgeReview(teamId, playerId, request),
    onSuccess: refresh,
  });
}

export function useCancelReview(teamId: string) {
  const refresh = useTeamRefresh(teamId);
  return useMutation({
    mutationFn: (reviewId: string) => cancelKnowledgeReview(teamId, reviewId),
    onSuccess: refresh,
  });
}
