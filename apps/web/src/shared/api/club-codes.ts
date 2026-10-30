import {
  ClubCodeListResponseSchema,
  ClubCodePreviewResponseSchema,
  ClubResponseSchema,
  CreateClubCodeResponseSchema,
  CreateClubResponseSchema,
  CreateTeamResponseSchema,
  type ClubCodeListResponse,
  type ClubCodePreviewResponse,
  type ClubResponse,
  type CreateClubCodeRequest,
  type CreateClubCodeResponse,
  type CreateClubRequest,
  type CreateClubResponse,
  type CreateTeamRequest,
  type CreateTeamResponse,
  type UpdateClubRequest,
} from '@sdl/contracts';

import { apiFetch, apiRequest } from './http';

/** Códigos de alta de clubes: solo el administrador de la plataforma (2026-10-29). */
export function createClubCode(request: CreateClubCodeRequest): Promise<CreateClubCodeResponse> {
  return apiRequest('/api/v1/admin/club-codes', CreateClubCodeResponseSchema, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

export function fetchClubCodes(): Promise<ClubCodeListResponse> {
  return apiRequest('/api/v1/admin/club-codes', ClubCodeListResponseSchema);
}

export async function revokeClubCode(id: string): Promise<void> {
  await apiFetch(`/api/v1/admin/club-codes/${id}`, { method: 'DELETE' });
}

/** Público: si el código de alta sirve (404 o 422 con el motivo si no). */
export function fetchClubCodePreview(code: string): Promise<ClubCodePreviewResponse> {
  return apiRequest(
    `/api/v1/club-codes/${encodeURIComponent(code)}`,
    ClubCodePreviewResponseSchema,
  );
}

/** Crear mi club con el código: queda de dueño del club y entrenador del equipo. */
export function createClub(request: CreateClubRequest): Promise<CreateClubResponse> {
  return apiRequest('/api/v1/clubs', CreateClubResponseSchema, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/** Otro equipo del club (dueño o admin): queda de entrenador. */
export function createTeam(
  clubId: string,
  request: CreateTeamRequest,
): Promise<CreateTeamResponse> {
  return apiRequest(`/api/v1/clubs/${clubId}/teams`, CreateTeamResponseSchema, {
    method: 'POST',
    body: JSON.stringify(request),
  });
}

/** La pantalla del club (dueño y admins). */
export function fetchClub(clubId: string): Promise<ClubResponse> {
  return apiRequest(`/api/v1/clubs/${clubId}`, ClubResponseSchema);
}

export function updateClub(clubId: string, patch: UpdateClubRequest): Promise<ClubResponse> {
  return apiRequest(`/api/v1/clubs/${clubId}`, ClubResponseSchema, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
}

/** Archivar o desarchivar un equipo del club (dueño o admin). */
export function setTeamArchived(
  clubId: string,
  teamId: string,
  archived: boolean,
): Promise<ClubResponse> {
  return apiRequest(`/api/v1/clubs/${clubId}/teams/${teamId}`, ClubResponseSchema, {
    method: 'PATCH',
    body: JSON.stringify({ archived }),
  });
}

/** El dueño nombra admin a un integrante de sus equipos. */
export function addClubAdmin(clubId: string, userId: string): Promise<ClubResponse> {
  return apiRequest(`/api/v1/clubs/${clubId}/admins`, ClubResponseSchema, {
    method: 'POST',
    body: JSON.stringify({ userId }),
  });
}

/** El dueño quita a un admin (al dueño no). */
export function removeClubAdmin(clubId: string, userId: string): Promise<ClubResponse> {
  return apiRequest(`/api/v1/clubs/${clubId}/admins/${userId}`, ClubResponseSchema, {
    method: 'DELETE',
  });
}
