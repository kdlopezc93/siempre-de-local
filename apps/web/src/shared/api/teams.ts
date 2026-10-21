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
