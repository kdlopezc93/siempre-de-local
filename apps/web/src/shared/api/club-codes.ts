import {
  ClubCodeListResponseSchema,
  CreateClubCodeResponseSchema,
  type ClubCodeListResponse,
  type CreateClubCodeRequest,
  type CreateClubCodeResponse,
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
