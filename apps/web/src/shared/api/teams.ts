import {
  AcceptConsentResponseSchema,
  AcceptInvitationResponseSchema,
  InvitationPreviewResponseSchema,
  POLICY_VERSION,
  type AcceptConsentResponse,
  type AcceptInvitationResponse,
  type InvitationPreviewResponse,
} from '@sdl/contracts';

import { apiRequest } from './http';

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
