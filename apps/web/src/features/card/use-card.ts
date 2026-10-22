import type { CreateRatingRequest, UpdateTeamRequest } from '@sdl/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createRating,
  fetchMyCard,
  fetchRatingHistory,
  updateTeam,
} from '../../shared/api/ratings';

const historyKey = (teamId: string, playerId: string) =>
  ['team', teamId, 'ratings', playerId] as const;

/** Fotos de la tarjeta de un jugador, de la más reciente a la más antigua (cuerpo técnico). */
export function useRatingHistory(teamId: string, playerId: string) {
  return useQuery({
    queryKey: historyKey(teamId, playerId),
    queryFn: () => fetchRatingHistory(teamId, playerId),
  });
}

/** Al puntuar se refresca todo lo del equipo: histórico, plantilla y perfil la muestran. */
export function useCreateRating(teamId: string, playerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateRatingRequest) => createRating(teamId, playerId, request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team', teamId] }),
  });
}

export function useMyCard(teamId: string) {
  return useQuery({
    queryKey: ['me', 'card', teamId],
    queryFn: () => fetchMyCard(teamId),
    // 403 (oculta) o 404 son respuestas, no fallos pasajeros.
    retry: false,
  });
}

/** El interruptor D8: el equipo actualizado reemplaza al guardado. */
export function useUpdateTeam(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patch: UpdateTeamRequest) => updateTeam(teamId, patch),
    onSuccess: (team) => queryClient.setQueryData(['team', teamId], team),
  });
}
