import { useMutation, useQueryClient } from '@tanstack/react-query';

import {
  deleteAccount,
  deleteChild,
  downloadChildData,
  downloadMyData,
} from '../../shared/api/account';
import { clearApiCache } from '../../shared/offline/api-cache';
import { saveFile } from '../../shared/save-file';
import { SESSION_KEY } from '../auth/use-session';

export function useDownloadMyData() {
  return useMutation({
    mutationFn: downloadMyData,
    onSuccess: ({ blob, filename }) => saveFile(blob, filename),
  });
}

/** Al eliminarla, la sesión ya no existe: se limpia lo guardado en este celular. */
export function useDeleteAccount() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await deleteAccount();
      await clearApiCache();
    },
    onSuccess: () => queryClient.setQueryData(SESSION_KEY, null),
  });
}

/** Los datos de un hijo (2026-11-10). */
export function useDownloadChildData() {
  return useMutation({
    mutationFn: (minorId: string) => downloadChildData(minorId),
    onSuccess: ({ blob, filename }) => saveFile(blob, filename),
  });
}

/** Borrar a un hijo: `/me` deja de traerlo, y con él sus pantallas. */
export function useDeleteChild() {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (minorId: string) => deleteChild(minorId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: SESSION_KEY }),
  });
}
