import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { disablePush, enablePush, pushState } from './push';

const KEY = ['push-state'] as const;

/** El estado de los avisos en este celular, y activarlos o apagarlos. */
export function usePush() {
  const queryClient = useQueryClient();
  const state = useQuery({ queryKey: KEY, queryFn: pushState, staleTime: Infinity, retry: false });
  const toggle = useMutation({
    mutationFn: (on: boolean) => (on ? enablePush() : disablePush()),
    onSuccess: (next) => queryClient.setQueryData(KEY, next),
  });
  return { state: state.data, toggle };
}
