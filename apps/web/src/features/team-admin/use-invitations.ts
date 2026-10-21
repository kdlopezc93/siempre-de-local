import type { TeamResponse } from '@sdl/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useState } from 'react';

import {
  createInvitation,
  fetchInvitations,
  fetchTeam,
  revokeInvitation,
} from '../../shared/api/teams';

export function useTeam(teamId: string) {
  return useQuery({ queryKey: ['team', teamId], queryFn: () => fetchTeam(teamId) });
}

const invitationsKey = (teamId: string) => ['team', teamId, 'invitations'] as const;

export function useInvitations(teamId: string) {
  return useQuery({ queryKey: invitationsKey(teamId), queryFn: () => fetchInvitations(teamId) });
}

export function useCreateInvitation(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: () => createInvitation(teamId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invitationsKey(teamId) }),
  });
}

export function useRevokeInvitation(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (invitationId: string) => revokeInvitation(teamId, invitationId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: invitationsKey(teamId) }),
  });
}

/** El mensaje que el entrenador manda: corto, en su voz y con el enlace al final. */
export function invitationMessage(team: TeamResponse['team'], joinUrl: string): string {
  return `Te convoco a ${team.name} (${team.club.name}). Entra con este enlace para unirte: ${joinUrl}`;
}

/** wa.me abre WhatsApp (app o web) con el mensaje listo para elegir el chat del equipo. */
export function whatsappUrl(message: string): string {
  return `https://wa.me/?text=${encodeURIComponent(message)}`;
}

/** Copiar al portapapeles con aviso de 2 s; false si el navegador no lo permite. */
export function useCopy() {
  const [copied, setCopied] = useState(false);
  async function copy(text: string): Promise<boolean> {
    try {
      await navigator.clipboard.writeText(text);
      setCopied(true);
      window.setTimeout(() => setCopied(false), 2000);
      return true;
    } catch {
      return false;
    }
  }
  return { copied, copy };
}
