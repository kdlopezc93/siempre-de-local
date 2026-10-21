import type { AttemptResult, SubmitAttemptRequest } from '@sdl/contracts';
import { useQuery } from '@tanstack/react-query';

import { fetchMyAttempts } from '../../shared/api/quiz';
import { useOutbox } from '../../shared/offline/use-outbox';

export type HistoryEntry =
  | { kind: 'official'; submittedAt: string; result: AttemptResult }
  /** Hecho sin señal y todavía en la cola del celular. */
  | { kind: 'pending'; submittedAt: string; teamId: string };

/**
 * Mis tests: los oficiales del servidor y los que siguen pendientes en la cola, del más
 * reciente al más antiguo. Sin red, el service worker responde con la última lista.
 */
export function useHistory(userId: string) {
  const attempts = useQuery({
    queryKey: ['me', 'attempts'],
    queryFn: fetchMyAttempts,
    networkMode: 'offlineFirst',
  });
  const outbox = useOutbox();

  const official = new Set(attempts.data?.items.map((item) => item.clientAttemptId));
  const pending: HistoryEntry[] = outbox.items
    .filter(
      (item) =>
        item.kind === 'orientation-attempt' &&
        item.userId === userId &&
        item.status === 'pending' &&
        !official.has(item.id),
    )
    .map((item) => {
      const payload = item.payload as SubmitAttemptRequest;
      return { kind: 'pending', submittedAt: payload.submittedAt, teamId: payload.teamId };
    });

  const entries: HistoryEntry[] = [
    ...pending,
    ...(attempts.data?.items ?? []).map((result): HistoryEntry => ({
      kind: 'official',
      submittedAt: result.submittedAt,
      result,
    })),
  ].sort((a, b) => b.submittedAt.localeCompare(a.submittedAt));

  return {
    entries,
    isPending: attempts.isPending,
    isError: attempts.isError && entries.length === 0,
  };
}
