import {
  AssessmentResponseSchema,
  PlayerProfileResponseSchema,
  SquadResponseSchema,
  TeamMembersResponseSchema,
  TestReminderResponseSchema,
  type Assessment,
  type CreateAssessmentRequest,
  type PlayerProfileResponse,
  type SquadResponse,
  type TeamMembersResponse,
  type TestReminderResponse,
} from '@sdl/contracts';

import { apiRequest } from './http';

export function fetchSquad(teamId: string): Promise<SquadResponse> {
  return apiRequest(`/api/v1/teams/${teamId}/squad`, SquadResponseSchema);
}

/** Los integrantes del equipo, para todos sus miembros (D11: solo la mejor banda). */
export function fetchTeamMembers(teamId: string): Promise<TeamMembersResponse> {
  return apiRequest(`/api/v1/teams/${teamId}/members`, TeamMembersResponseSchema);
}

/** Recordarles el test a los que no lo han hecho (cuerpo técnico). */
export function sendTestReminder(teamId: string): Promise<TestReminderResponse> {
  return apiRequest(`/api/v1/teams/${teamId}/test-reminders`, TestReminderResponseSchema, {
    method: 'POST',
  });
}

export async function createAssessment(
  teamId: string,
  request: CreateAssessmentRequest,
): Promise<Assessment> {
  const { assessment } = await apiRequest(
    `/api/v1/teams/${teamId}/assessments`,
    AssessmentResponseSchema,
    { method: 'POST', body: JSON.stringify(request) },
  );
  return assessment;
}

export function fetchPlayerProfile(
  teamId: string,
  playerId: string,
): Promise<PlayerProfileResponse> {
  return apiRequest(
    `/api/v1/teams/${teamId}/players/${playerId}/profile`,
    PlayerProfileResponseSchema,
  );
}
