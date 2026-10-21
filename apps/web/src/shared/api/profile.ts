import {
  ProfileResponseSchema,
  type PositionCode,
  type Profile,
  type UpdateProfileRequest,
} from '@sdl/contracts';

import { apiRequest } from './http';

export async function updateProfile(patch: UpdateProfileRequest): Promise<Profile> {
  const { profile } = await apiRequest('/api/v1/me/profile', ProfileResponseSchema, {
    method: 'PATCH',
    body: JSON.stringify(patch),
  });
  return profile;
}

export async function setPreferredPositions(positions: PositionCode[]): Promise<Profile> {
  const { profile } = await apiRequest('/api/v1/me/preferred-positions', ProfileResponseSchema, {
    method: 'PUT',
    body: JSON.stringify({ positions }),
  });
  return profile;
}
