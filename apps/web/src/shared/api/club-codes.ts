import {
  ClubCodeListResponseSchema,
  ClubCodePreviewResponseSchema,
  CreateClubCodeResponseSchema,
  CreateClubResponseSchema,
  type ClubCodeListResponse,
  type ClubCodePreviewResponse,
  type CreateClubCodeRequest,
  type CreateClubCodeResponse,
  type CreateClubRequest,
  type CreateClubResponse,
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
