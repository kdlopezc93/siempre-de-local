import type { UpdateClubRequest } from '@sdl/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { fetchClub, setTeamArchived, updateClub } from '../../shared/api/club-codes';
import { SESSION_KEY } from '../auth/use-session';

const clubKey = (clubId: string) => ['club', clubId] as const;

export function useClub(clubId: string) {
  return useQuery({ queryKey: clubKey(clubId), queryFn: () => fetchClub(clubId) });
}

/** El club actualizado reemplaza al guardado; el nombre también sale en /me y en los equipos. */
export function useUpdateClub(clubId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateClubRequest) => updateClub(clubId, patch),
    onSuccess: async (club) => {
      queryClient.setQueryData(clubKey(clubId), club);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: SESSION_KEY }),
        queryClient.invalidateQueries({ queryKey: ['team'] }),
      ]);
    },
  });
}

/** Archivar o desarchivar: cambia quién ve el equipo, así que también /me y los equipos. */
export function useArchiveTeam(clubId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ teamId, archived }: { teamId: string; archived: boolean }) =>
      setTeamArchived(clubId, teamId, archived),
    onSuccess: async (club) => {
      queryClient.setQueryData(clubKey(clubId), club);
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: SESSION_KEY }),
        queryClient.invalidateQueries({ queryKey: ['team'] }),
      ]);
    },
  });
}
