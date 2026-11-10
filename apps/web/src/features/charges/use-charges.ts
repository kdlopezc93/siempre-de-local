import type {
  ChargeResponse,
  CreateChargeRequest,
  MyPaymentRequest,
  PaymentRequest,
  ShareRequest,
  SponsorRequest,
  UpdateChargeRequest,
} from '@sdl/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createCharge,
  fetchCharge,
  fetchCharges,
  fetchMyCharges,
  registerPayment,
  remindCharges,
  reportPayment,
  reviewPayment,
  setChargeShare,
  setChargeSponsor,
  updateCharge,
} from '../../shared/api/charges';
import { fetchChildCharges, reportChildPayment } from '../../shared/api/family';

export const chargesKey = (teamId: string) => ['team', teamId, 'charges'] as const;
/** Lo mío, o lo de un hijo (el acudiente, 2026-11-10). */
const myChargesKey = (teamId: string, minorId?: string) =>
  minorId
    ? (['team', teamId, 'my-charges', 'child', minorId] as const)
    : (['team', teamId, 'my-charges'] as const);

export function useCharges(teamId: string, enabled = true) {
  return useQuery({
    queryKey: chargesKey(teamId),
    queryFn: () => fetchCharges(teamId),
    enabled,
    networkMode: 'offlineFirst',
  });
}

export function useCharge(teamId: string, chargeId: string) {
  return useQuery({
    queryKey: [...chargesKey(teamId), chargeId],
    queryFn: () => fetchCharge(teamId, chargeId),
    networkMode: 'offlineFirst',
  });
}

/**
 * Lo que debe quien mira; `enabled` en falso para quien no es del equipo como jugador. Con
 * `minorId`, lo de ese hijo (el acudiente, 2026-11-10).
 */
export function useMyCharges(teamId: string, enabled = true, minorId?: string) {
  return useQuery({
    queryKey: myChargesKey(teamId, minorId),
    queryFn: () => (minorId ? fetchChildCharges(minorId, teamId) : fetchMyCharges(teamId)),
    enabled,
    networkMode: 'offlineFirst',
  });
}

/** Tras cualquier cambio de un cobro: el cobro nuevo en caché, y la lista y lo mío al día. */
function useChargeMutation<V>(teamId: string, fn: (vars: V) => Promise<ChargeResponse>) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: fn,
    onSuccess: (data) => {
      queryClient.setQueryData([...chargesKey(teamId), data.charge.id], data);
      void queryClient.invalidateQueries({ queryKey: chargesKey(teamId), exact: true });
      void queryClient.invalidateQueries({ queryKey: myChargesKey(teamId) });
    },
  });
}

export function useRemindCharges(teamId: string) {
  return useMutation({ mutationFn: () => remindCharges(teamId) });
}

export const useCreateCharge = (teamId: string) =>
  useChargeMutation(teamId, (request: CreateChargeRequest) => createCharge(teamId, request));

export const useUpdateCharge = (teamId: string, chargeId: string) =>
  useChargeMutation(teamId, (patch: UpdateChargeRequest) => updateCharge(teamId, chargeId, patch));

export const useSetShare = (teamId: string, chargeId: string) =>
  useChargeMutation(teamId, ({ userId, ...request }: ShareRequest & { userId: string }) =>
    setChargeShare(teamId, chargeId, userId, request),
  );

export const useSetSponsor = (teamId: string, chargeId: string) =>
  useChargeMutation(teamId, ({ userId, ...request }: SponsorRequest & { userId: string }) =>
    setChargeSponsor(teamId, chargeId, userId, request),
  );

export const useRegisterPayment = (teamId: string, chargeId: string) =>
  useChargeMutation(teamId, (request: PaymentRequest) =>
    registerPayment(teamId, chargeId, request),
  );

export const useReviewPayment = (teamId: string, chargeId: string) =>
  useChargeMutation(
    teamId,
    ({ paymentId, decision }: { paymentId: string; decision: 'confirm' | 'reject' }) =>
      reviewPayment(teamId, chargeId, paymentId, decision),
  );

/** "Ya pagué": la respuesta trae lo mío (o lo del hijo) al día. */
export function useReportPayment(teamId: string, minorId?: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ chargeId, forUserId, ...request }: MyPaymentRequest & { chargeId: string }) =>
      minorId
        ? reportChildPayment(minorId, teamId, chargeId, request)
        : reportPayment(teamId, chargeId, { ...request, ...(forUserId ? { forUserId } : {}) }),
    onSuccess: (data) => {
      queryClient.setQueryData(myChargesKey(teamId, minorId), data);
      void queryClient.invalidateQueries({ queryKey: chargesKey(teamId) });
    },
  });
}
