import type { UpdateMemberRolesRequest } from '@sdl/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchTeamMembers } from '../../shared/api/squad';
import { movePlayer, removeMember, transferCoach, updateMemberRoles } from '../../shared/api/teams';
import { SESSION_KEY } from '../auth/use-session';

/** Los integrantes, con la misma llave que Equipo → Integrantes. */
export function useTeamMembers(teamId: string) {
  return useQuery({
    queryKey: ['team', teamId, 'members'],
    queryFn: () => fetchTeamMembers(teamId),
  });
}

/** Cambiar roles mueve permisos: se refresca todo lo del equipo y la sesión (mis roles). */
function useRefresh(teamId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ['team', teamId] }),
      queryClient.invalidateQueries({ queryKey: SESSION_KEY }),
    ]);
}

export function useUpdateRoles(teamId: string) {
  const refresh = useRefresh(teamId);
  return useMutation({
    mutationFn: ({ userId, patch }: { userId: string; patch: UpdateMemberRolesRequest }) =>
      updateMemberRoles(teamId, userId, patch),
    onSettled: refresh,
  });
}

export function useTransferCoach(teamId: string) {
  const refresh = useRefresh(teamId);
  return useMutation({
    mutationFn: (userId: string) => transferCoach(teamId, userId),
    onSuccess: refresh,
  });
}

export function useRemoveMember(teamId: string) {
  const refresh = useRefresh(teamId);
  return useMutation({
    mutationFn: (userId: string) => removeMember(teamId, userId),
    onSuccess: refresh,
  });
}

/** Pasar de grupo (2026-11-10): cambian los dos grupos; se refresca lo de ambos. */
export function useMovePlayer(teamId: string) {
  const queryClient = useQueryClient();
  const refresh = useRefresh(teamId);
  return useMutation({
    mutationFn: ({ userId, toTeamId }: { userId: string; toTeamId: string }) =>
      movePlayer(teamId, userId, toTeamId),
    onSuccess: (_data, { toTeamId }) =>
      Promise.all([refresh(), queryClient.invalidateQueries({ queryKey: ['team', toTeamId] })]),
  });
}
