import type { CreateInvitationRequest, TeamRole, TeamResponse } from '@sdl/contracts';
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
    mutationFn: (request?: CreateInvitationRequest) => createInvitation(teamId, request),
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

/** A quién invita el enlace (2026-10-29): jugadores, o alguien del cuerpo técnico. */
export type InviteKind = TeamRole;

export const INVITE_KINDS: Record<InviteKind, { label: string; what: string }> = {
  player: { label: 'Jugadores', what: 'Sirve 7 días y para hasta 30 personas.' },
  assistant: { label: 'Asistente', what: 'Sirve 7 días.' },
  coach: {
    label: 'Entrenador',
    what: 'Sirve 7 días. Al entrar queda de entrenador y el actual pasa a asistente.',
  },
};

/** Lo que se pide al API: las de cuerpo técnico son para una persona. */
export function invitationRequest(kind: InviteKind, alsoPlays: boolean): CreateInvitationRequest {
  return kind === 'player' ? { role: 'player' } : { role: kind, alsoPlays, maxUses: 1 };
}

/** Cómo se nombra una invitación en la lista. */
export function invitationLabel({ role, alsoPlays }: { role: TeamRole; alsoPlays: boolean }) {
  if (role === 'player') return 'Para jugadores';
  return `${role === 'coach' ? 'Entrenador' : 'Asistente'}${alsoPlays ? ' que también juega' : ''}`;
}

/** El mensaje que el entrenador manda: corto, en su voz y con el enlace al final. */
export function invitationMessage(
  team: TeamResponse['team'],
  joinUrl: string,
  role: TeamRole = 'player',
): string {
  if (role === 'player') {
    return `Te convoco a ${team.name} (${team.club.name}). Entra con este enlace para unirte: ${joinUrl}`;
  }
  const as = role === 'coach' ? 'entrenador' : 'asistente';
  return `Te invito al cuerpo técnico de ${team.name} (${team.club.name}) como ${as}. Entra con este enlace: ${joinUrl}`;
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
