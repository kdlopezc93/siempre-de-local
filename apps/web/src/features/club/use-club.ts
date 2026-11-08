import type { CreateVenueRequest, UpdateClubRequest } from '@sdl/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  addClubAdmin,
  createVenue,
  deleteVenue,
  fetchClub,
  removeClubAdmin,
  setTeamArchived,
  updateClub,
  updateVenue,
} from '../../shared/api/club-codes';
import { SESSION_KEY } from '../auth/use-session';

const clubKey = (clubId: string) => ['club', clubId] as const;

/** `enabled: false` cuando quien pregunta no maneja el club (el API diría 403). */
export function useClub(clubId: string, { enabled = true }: { enabled?: boolean } = {}) {
  return useQuery({ queryKey: clubKey(clubId), queryFn: () => fetchClub(clubId), enabled });
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

/** Nombrar o quitar un admin del club (dueño). */
export function useClubAdmin(clubId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ userId, admin }: { userId: string; admin: boolean }) =>
      admin ? addClubAdmin(clubId, userId) : removeClubAdmin(clubId, userId),
    onSuccess: (club) => queryClient.setQueryData(clubKey(clubId), club),
  });
}

export type VenueChange =
  | { action: 'create'; venue: CreateVenueRequest }
  | { action: 'update'; venueId: string; venue: CreateVenueRequest }
  | { action: 'delete'; venueId: string };

/** Agregar, cambiar o borrar una sede (escuelas): cambia lo que muestran sus grupos. */
export function useVenue(clubId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (change: VenueChange) =>
      change.action === 'create'
        ? createVenue(clubId, change.venue)
        : change.action === 'update'
          ? updateVenue(clubId, change.venueId, change.venue)
          : deleteVenue(clubId, change.venueId),
    onSuccess: async (club) => {
      queryClient.setQueryData(clubKey(clubId), club);
      await queryClient.invalidateQueries({ queryKey: ['team'] });
    },
  });
}
