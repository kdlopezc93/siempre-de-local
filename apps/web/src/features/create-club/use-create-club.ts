import type { CreateClubRequest } from '@sdl/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createClub, fetchClubCodePreview } from '../../shared/api/club-codes';
import { ApiError } from '../../shared/api/http';
import { acceptConsent } from '../../shared/api/teams';
import { SESSION_KEY } from '../auth/use-session';

export function useClubCodePreview(code: string) {
  return useQuery({
    queryKey: ['club-code', code],
    queryFn: () => fetchClubCodePreview(code),
    // Un código vencido o inexistente no se arregla reintentando.
    retry: (failures, error) => !(error instanceof ApiError && error.status < 500) && failures < 2,
    staleTime: 60_000,
  });
}

/**
 * Crea el club. Si todavía no aceptó la política, la acepta primero: es el mismo toque, y el
 * API exige ese orden (CONSENT_REQUIRED).
 */
export function useCreateClub() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({
      request,
      withConsent,
    }: {
      request: CreateClubRequest;
      withConsent: boolean;
    }) => {
      if (withConsent) await acceptConsent();
      return createClub(request);
    },
    // El club y el equipo nuevos llegan en /me.
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SESSION_KEY }),
  });
}

/** Sugerencias de categoría: se puede escribir otra. */
export const CATEGORY_SUGGESTIONS = ['Libre', 'Veteranos', 'Femenino', 'Mixto'] as const;
