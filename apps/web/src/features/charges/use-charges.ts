import type {
  ChargeResponse,
  CreateChargeRequest,
  MyPaymentRequest,
  PaymentRequest,
  ShareRequest,
  UpdateChargeRequest,
} from '@sdl/contracts';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import {
  createCharge,
  fetchCharge,
  fetchCharges,
  fetchMyCharges,
  registerPayment,
  reportPayment,
  reviewPayment,
  setChargeShare,
  updateCharge,
} from '../../shared/api/charges';

export const chargesKey = (teamId: string) => ['team', teamId, 'charges'] as const;
const myChargesKey = (teamId: string) => ['team', teamId, 'my-charges'] as const;

export function useCharges(teamId: string) {
  return useQuery({
    queryKey: chargesKey(teamId),
    queryFn: () => fetchCharges(teamId),
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

/** Lo que debe quien mira; `enabled` en falso para quien no es del equipo como jugador. */
export function useMyCharges(teamId: string, enabled = true) {
  return useQuery({
    queryKey: myChargesKey(teamId),
    queryFn: () => fetchMyCharges(teamId),
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

export const useCreateCharge = (teamId: string) =>
  useChargeMutation(teamId, (request: CreateChargeRequest) => createCharge(teamId, request));

export const useUpdateCharge = (teamId: string, chargeId: string) =>
  useChargeMutation(teamId, (patch: UpdateChargeRequest) => updateCharge(teamId, chargeId, patch));

export const useSetShare = (teamId: string, chargeId: string) =>
  useChargeMutation(teamId, ({ userId, ...request }: ShareRequest & { userId: string }) =>
    setChargeShare(teamId, chargeId, userId, request),
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

/** "Ya pagué": la respuesta trae lo mío al día. */
export function useReportPayment(teamId: string) {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ chargeId, ...request }: MyPaymentRequest & { chargeId: string }) =>
      reportPayment(teamId, chargeId, request),
    onSuccess: (data) => {
      queryClient.setQueryData(myChargesKey(teamId), data);
      void queryClient.invalidateQueries({ queryKey: chargesKey(teamId) });
    },
  });
}
