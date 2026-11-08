import type { ClubKind, CreateClubCodeRequest } from '@sdl/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createClubCode, fetchClubCodes, revokeClubCode } from '../../shared/api/club-codes';

const KEY = ['platform', 'club-codes'] as const;

export function useClubCodes() {
  return useQuery({ queryKey: KEY, queryFn: fetchClubCodes });
}

export function useCreateClubCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateClubCodeRequest) => createClubCode(request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

export function useRevokeClubCode() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: revokeClubCode,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: KEY }),
  });
}

/** El mensaje para mandar por WhatsApp: qué es, el código y el enlace. */
export function clubCodeMessage(code: string, url: string, kind: ClubKind = 'club'): string {
  const what = kind === 'school' ? 'tu escuela y su primer grupo' : 'tu club y tu equipo';
  return `Con este código creas ${what} en Siempre de Local: ${code}. Entra aquí: ${url}`;
}
