import { useMutation, useQueryClient } from '@tanstack/react-query';

import { acceptConsent } from '../../shared/api/teams';
import { SESSION_KEY } from '../auth/use-session';

/** Acepta la política vigente y refresca la sesión (que trae `consent`). */
export function useAcceptConsent() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: acceptConsent,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SESSION_KEY }),
  });
}
