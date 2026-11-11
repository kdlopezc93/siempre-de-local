import {
  MatchListResponseSchema,
  MatchResponseSchema,
  MyChargesResponseSchema,
  RegisterMinorResponseSchema,
  type ChildPaymentRequest,
  type MatchListResponse,
  type MatchReply,
  type MatchResponse,
  type MyChargesResponse,
  type RegisterMinorRequest,
  type RegisterMinorResponse,
} from '@sdl/contracts';

import { apiRequest } from './http';

/**
 * El acudiente y sus hijos (escuelas, 2026-11-10): inscribir con el enlace para acudientes y,
 * después, lo que hace por cada uno en su grupo. El API comprueba que el niño es suyo.
 */
const child = (minorId: string, teamId: string) => `/api/v1/me/children/${minorId}/teams/${teamId}`;

const send = (body: object, method = 'POST') => ({ method, body: JSON.stringify(body) });

export function registerMinor(
  code: string,
  request: RegisterMinorRequest,
): Promise<RegisterMinorResponse> {
  return apiRequest(
    `/api/v1/invitations/${encodeURIComponent(code)}/minors`,
    RegisterMinorResponseSchema,
    send(request),
  );
}

export function fetchChildMatches(minorId: string, teamId: string): Promise<MatchListResponse> {
  return apiRequest(`${child(minorId, teamId)}/matches`, MatchListResponseSchema);
}

export function replyForChild(
  minorId: string,
  teamId: string,
  matchId: string,
  reply: MatchReply,
): Promise<MatchResponse> {
  return apiRequest(
    `${child(minorId, teamId)}/matches/${matchId}/reply`,
    MatchResponseSchema,
    send({ reply }, 'PUT'),
  );
}

export function fetchChildCharges(minorId: string, teamId: string): Promise<MyChargesResponse> {
  return apiRequest(`${child(minorId, teamId)}/charges`, MyChargesResponseSchema);
}

export function reportChildPayment(
  minorId: string,
  teamId: string,
  chargeId: string,
  request: ChildPaymentRequest,
): Promise<MyChargesResponse> {
  return apiRequest(
    `${child(minorId, teamId)}/charges/${chargeId}/payments`,
    MyChargesResponseSchema,
    send(request),
  );
}
