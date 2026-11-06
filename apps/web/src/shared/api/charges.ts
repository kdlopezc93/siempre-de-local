import {
  ChargeListResponseSchema,
  ChargeResponseSchema,
  ChargesReminderResponseSchema,
  MyChargesResponseSchema,
  type ChargeListResponse,
  type ChargeResponse,
  type ChargesReminderResponse,
  type CreateChargeRequest,
  type MyChargesResponse,
  type MyPaymentRequest,
  type PaymentRequest,
  type ShareRequest,
  type SponsorRequest,
  type UpdateChargeRequest,
} from '@sdl/contracts';

import { apiRequest } from './http';

/** Cobros del equipo (`06` Cobros): cuerpo técnico y tesorero; "lo mío", cada jugador. */
const base = (teamId: string) => `/api/v1/teams/${teamId}/charges`;
const mine = (teamId: string) => `/api/v1/teams/${teamId}/me/charges`;

const send = (body: object, method = 'POST') => ({ method, body: JSON.stringify(body) });

export function fetchCharges(teamId: string): Promise<ChargeListResponse> {
  return apiRequest(base(teamId), ChargeListResponseSchema);
}

export function fetchCharge(teamId: string, chargeId: string): Promise<ChargeResponse> {
  return apiRequest(`${base(teamId)}/${chargeId}`, ChargeResponseSchema);
}

export function createCharge(
  teamId: string,
  request: CreateChargeRequest,
): Promise<ChargeResponse> {
  return apiRequest(base(teamId), ChargeResponseSchema, send(request));
}

export function updateCharge(
  teamId: string,
  chargeId: string,
  patch: UpdateChargeRequest,
): Promise<ChargeResponse> {
  return apiRequest(`${base(teamId)}/${chargeId}`, ChargeResponseSchema, send(patch, 'PATCH'));
}

export function setChargeShare(
  teamId: string,
  chargeId: string,
  userId: string,
  request: ShareRequest,
): Promise<ChargeResponse> {
  return apiRequest(
    `${base(teamId)}/${chargeId}/shares/${userId}`,
    ChargeResponseSchema,
    send(request, 'PUT'),
  );
}

/** "Recordar a los que deben": un aviso a cada uno, sin el valor. */
export function remindCharges(teamId: string): Promise<ChargesReminderResponse> {
  return apiRequest(`${base(teamId)}/reminders`, ChargesReminderResponseSchema, send({}));
}

/** Que la parte de alguien la asuma otro jugador o el equipo (`null`: se la devuelve). */
export function setChargeSponsor(
  teamId: string,
  chargeId: string,
  userId: string,
  request: SponsorRequest,
): Promise<ChargeResponse> {
  return apiRequest(
    `${base(teamId)}/${chargeId}/shares/${userId}/sponsor`,
    ChargeResponseSchema,
    send(request, 'PUT'),
  );
}

export function registerPayment(
  teamId: string,
  chargeId: string,
  request: PaymentRequest,
): Promise<ChargeResponse> {
  return apiRequest(`${base(teamId)}/${chargeId}/payments`, ChargeResponseSchema, send(request));
}

export function reviewPayment(
  teamId: string,
  chargeId: string,
  paymentId: string,
  decision: 'confirm' | 'reject',
): Promise<ChargeResponse> {
  return apiRequest(
    `${base(teamId)}/${chargeId}/payments/${paymentId}/${decision}`,
    ChargeResponseSchema,
    { method: 'POST' },
  );
}

export function fetchMyCharges(teamId: string): Promise<MyChargesResponse> {
  return apiRequest(mine(teamId), MyChargesResponseSchema);
}

export function reportPayment(
  teamId: string,
  chargeId: string,
  request: MyPaymentRequest,
): Promise<MyChargesResponse> {
  return apiRequest(`${mine(teamId)}/${chargeId}/payments`, MyChargesResponseSchema, send(request));
}
