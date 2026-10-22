import type { CreateAssessmentRequest } from '@sdl/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { createAssessment, fetchPlayerProfile, fetchSquad } from '../../shared/api/squad';
import { downloadTeamExport } from '../../shared/api/team-data';
import { saveFile } from '../../shared/save-file';

const squadKey = (teamId: string) => ['team', teamId, 'squad'] as const;

export function useSquad(teamId: string) {
  return useQuery({ queryKey: squadKey(teamId), queryFn: () => fetchSquad(teamId) });
}

/** Todo lo de un jugador del equipo (cuerpo técnico). */
export function usePlayerProfile(teamId: string, playerId: string) {
  return useQuery({
    queryKey: ['team', teamId, 'players', playerId, 'profile'],
    queryFn: () => fetchPlayerProfile(teamId, playerId),
  });
}

/** Al valorar se refresca todo lo del equipo: puede destapar el test de ese jugador. */
export function useCreateAssessment(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: CreateAssessmentRequest) => createAssessment(teamId, request),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team', teamId] }),
  });
}

/** Descarga la plantilla en CSV (coach y admin del club). */
export function useExportTeam(teamId: string) {
  return useMutation({
    mutationFn: () => downloadTeamExport(teamId),
    onSuccess: ({ blob, filename }) => saveFile(blob, filename),
  });
}
