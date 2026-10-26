import type { CreateAssessmentRequest, SetInjuryRequest } from '@sdl/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createAssessment,
  fetchPlayerProfile,
  fetchSquad,
  sendTestReminder,
} from '../../shared/api/squad';
import { downloadTeamExport } from '../../shared/api/team-data';
import { setInjury, updateMember } from '../../shared/api/teams';
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

/** Recordarles el test a los que no lo han hecho: un aviso al celular (cuerpo técnico). */
export function useRemindTest(teamId: string) {
  return useMutation({ mutationFn: () => sendTestReminder(teamId) });
}

/** Descarga la plantilla en CSV (coach y admin del club). */
export function useExportTeam(teamId: string) {
  return useMutation({
    mutationFn: () => downloadTeamExport(teamId),
    onSuccess: ({ blob, filename }) => saveFile(blob, filename),
  });
}

/** El dorsal se ve en la plantilla, el perfil y el CSV: se refresca todo lo del equipo. */
export function useSetJersey(teamId: string, playerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (jerseyNumber: number | null) => updateMember(teamId, playerId, { jerseyNumber }),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team', teamId] }),
  });
}

/**
 * Marcar o desmarcar un lesionado: cambia la plantilla, el planificador, Integrantes y la
 * convocatoria, así que se refresca todo lo del equipo.
 */
export function useSetInjury(teamId: string, playerId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (request: SetInjuryRequest | null) => setInjury(teamId, playerId, request),
    // Los partidos también cuelgan de ['team', teamId].
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['team', teamId] }),
  });
}
