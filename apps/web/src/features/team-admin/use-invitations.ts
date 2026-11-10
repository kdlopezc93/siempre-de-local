import type { CreateInvitationRequest, InvitationRole, TeamResponse } from '@sdl/contracts';
import { categoryAges, childWord } from '@sdl/domain';
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

/**
 * A quién invita el enlace (2026-10-29): jugadores, o alguien del cuerpo técnico. En un grupo de
 * menores de una escuela (2026-11-10), acudientes: cada uno inscribe a su hijo.
 */
export type InviteKind = InvitationRole | 'guardians';

export const INVITE_KINDS: Record<InviteKind, { label: string; what: string }> = {
  guardians: { label: 'Acudientes', what: 'Sirve 7 días y para hasta 30 niños.' },
  player: { label: 'Jugadores', what: 'Sirve 7 días y para hasta 30 personas.' },
  assistant: { label: 'Asistente', what: 'Sirve 7 días.' },
  coach: {
    label: 'Entrenador',
    what: 'Sirve 7 días. Al entrar queda de entrenador y el actual pasa a asistente.',
  },
};

/** Lo que se pide al API: las de cuerpo técnico son para una persona. */
export function invitationRequest(kind: InviteKind, alsoPlays: boolean): CreateInvitationRequest {
  if (kind === 'guardians') return { role: 'player', forGuardians: true };
  return kind === 'player' ? { role: 'player' } : { role: kind, alsoPlays, maxUses: 1 };
}

/**
 * Qué enlaces se ofrecen en el equipo: acudientes si la categoría tiene menores, jugadores si
 * tiene mayores (o es un equipo de club), y el cuerpo técnico (entrenador, solo el admin del club).
 */
export function inviteKinds(team: TeamResponse['team'], clubAdmin: boolean, thisYear: number) {
  const school = team.club.kind === 'school';
  const ages = categoryAges(school ? team.birthYears : null, thisYear);
  const kinds: InviteKind[] = [
    ...(ages.minors ? (['guardians'] as const) : []),
    ...(ages.adults ? (['player'] as const) : []),
    'assistant',
    ...(clubAdmin ? (['coach'] as const) : []),
  ];
  return kinds;
}

/** Cómo se nombra una invitación en la lista. */
export function invitationLabel({
  role,
  alsoPlays,
  forGuardians = false,
}: {
  role: InvitationRole;
  alsoPlays: boolean;
  forGuardians?: boolean;
}) {
  if (forGuardians) return 'Para acudientes';
  if (role === 'player') return 'Para jugadores';
  return `${role === 'coach' ? 'Entrenador' : 'Asistente'}${alsoPlays ? ' que también juega' : ''}`;
}

/** El mensaje que el entrenador manda: corto, en su voz y con el enlace al final. */
export function invitationMessage(
  team: TeamResponse['team'],
  joinUrl: string,
  role: InvitationRole = 'player',
  forGuardians = false,
): string {
  if (forGuardians) {
    return `Inscribe a ${childWord(team.gender)} en ${team.name} (${team.club.name}). Entra con este enlace, con tu cuenta de Google: ${joinUrl}`;
  }
  if (role === 'player') {
    return `Te convoco a ${team.name} (${team.club.name}). Entra con este enlace para unirte: ${joinUrl}`;
  }
  const as = role === 'coach' ? 'entrenador' : 'asistente';
  return `Te invito al cuerpo técnico de ${team.name} (${team.club.name}) como ${as}. Entra con este enlace: ${joinUrl}`;
}

export { whatsappUrl } from '../../shared/share';

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
