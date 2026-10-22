import {
  AcceptConsentResponseSchema,
  AcceptInvitationResponseSchema,
  CreateInvitationResponseSchema,
  InvitationListResponseSchema,
  InvitationPreviewResponseSchema,
  POLICY_VERSION,
  TeamResponseSchema,
  type AcceptConsentResponse,
  type AcceptInvitationResponse,
  type CreateInvitationResponse,
  type InvitationListResponse,
  type InvitationPreviewResponse,
  type TeamResponse,
  type UpdateMemberRequest,
} from '@sdl/contracts';

import { apiFetch, apiRequest } from './http';

/** Público: a qué equipo invita el enlace. */
export function fetchInvitationPreview(code: string): Promise<InvitationPreviewResponse> {
  return apiRequest(
    `/api/v1/invitations/${encodeURIComponent(code)}`,
    InvitationPreviewResponseSchema,
  );
}

export function acceptInvitation(code: string): Promise<AcceptInvitationResponse> {
  return apiRequest(
    `/api/v1/invitations/${encodeURIComponent(code)}/accept`,
    AcceptInvitationResponseSchema,
    { method: 'POST', body: '{}' },
  );
}

/** Acepta la versión de la política que muestra esta build de la app. */
export function acceptConsent(): Promise<AcceptConsentResponse> {
  return apiRequest('/api/v1/me/consent', AcceptConsentResponseSchema, {
    method: 'POST',
    body: JSON.stringify({ policyVersion: POLICY_VERSION, ageConfirmed: true }),
  });
}

export function fetchTeam(teamId: string): Promise<TeamResponse> {
  return apiRequest(`/api/v1/teams/${teamId}`, TeamResponseSchema);
}

/** Enlace grupal por defecto: 7 días y hasta 30 personas (docs/05-api.md). */
export function createInvitation(teamId: string): Promise<CreateInvitationResponse> {
  return apiRequest(`/api/v1/teams/${teamId}/invitations`, CreateInvitationResponseSchema, {
    method: 'POST',
    body: JSON.stringify({ role: 'player' }),
  });
}

export function fetchInvitations(teamId: string): Promise<InvitationListResponse> {
  return apiRequest(`/api/v1/teams/${teamId}/invitations`, InvitationListResponseSchema);
}

export async function revokeInvitation(teamId: string, invitationId: string): Promise<void> {
  await apiFetch(`/api/v1/teams/${teamId}/invitations/${invitationId}`, { method: 'DELETE' });
}

/** El dorsal de un jugador (coach y admin del club); null lo quita. */
export async function updateMember(
  teamId: string,
  userId: string,
  patch: UpdateMemberRequest,
): Promise<void> {
  await apiFetch(`/api/v1/teams/${teamId}/members/${userId}`, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}
