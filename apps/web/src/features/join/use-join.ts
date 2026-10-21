import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { ApiError } from '../../shared/api/http';
import { acceptConsent, acceptInvitation, fetchInvitationPreview } from '../../shared/api/teams';
import { SESSION_KEY } from '../auth/use-session';

export function useInvitationPreview(code: string) {
  return useQuery({
    queryKey: ['invitation', code],
    queryFn: () => fetchInvitationPreview(code),
    // Un enlace vencido o inexistente no se arregla reintentando.
    retry: (failures, error) => !(error instanceof ApiError && error.status < 500) && failures < 2,
    staleTime: 60_000,
  });
}

/**
 * Une a la persona al equipo. Si todavía no aceptó la política, la acepta primero:
 * es el mismo toque ("Acepto y me uno"), y el API exige ese orden (CONSENT_REQUIRED).
 */
export function useJoinTeam(code: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ withConsent }: { withConsent: boolean }) => {
      if (withConsent) await acceptConsent();
      return acceptInvitation(code);
    },
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SESSION_KEY }),
  });
}

/** Mensaje para la persona: el API ya los redacta en el tono de la app. */
export function errorMessage(error: unknown): string {
  if (error instanceof ApiError && error.status < 500 && error.message) return error.message;
  return 'No pudimos conectar con el servidor. Revisa tu conexión e intenta de nuevo.';
}
