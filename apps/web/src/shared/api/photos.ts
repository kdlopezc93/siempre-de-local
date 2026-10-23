import {
  ProfileResponseSchema,
  TeamResponseSchema,
  type Profile,
  type TeamResponse,
} from '@sdl/contracts';

import { API_URL } from './config';
import { apiRequest } from './http';

/** La URL completa de una foto (el API devuelve la ruta). */
export const photoSrc = (path: string | null | undefined) =>
  path ? new URL(path, API_URL).toString() : undefined;

export async function uploadMyPhoto(photo: Blob): Promise<Profile> {
  const { profile } = await apiRequest('/api/v1/me/photo', ProfileResponseSchema, {
    method: 'PUT',
    headers: { 'content-type': photo.type },
    body: photo,
  });
  return profile;
}

export async function removeMyPhoto(): Promise<Profile> {
  const { profile } = await apiRequest('/api/v1/me/photo', ProfileResponseSchema, {
    method: 'DELETE',
  });
  return profile;
}

export function uploadTeamPhoto(teamId: string, photo: Blob): Promise<TeamResponse> {
  return apiRequest(`/api/v1/teams/${teamId}/photo`, TeamResponseSchema, {
    method: 'PUT',
    headers: { 'content-type': photo.type },
    body: photo,
  });
}

export function removeTeamPhoto(teamId: string): Promise<TeamResponse> {
  return apiRequest(`/api/v1/teams/${teamId}/photo`, TeamResponseSchema, { method: 'DELETE' });
}
